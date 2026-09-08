import { describe, expect, it } from "vitest";
import { buildAggregateBundle } from "@/lib/aggregateBundle";
import { readPublishedFantasyProsProjections } from "@/lib/fantasyProsProjectionSource";
import { normalizePlayerName } from "@/lib/util";
import { calculateBeerPlusProjectedPoints, buildStarterAwareValues } from "@/lib/beerPlusStrategy";
import { DEFAULT_DRAFT_SCORING_RULES, calculateDraftRounds } from "@/lib/draftLeagueConfig";
import { SheetDataSchema, RulesSchema, SavedSchema, WIFE_RULES, calculateSheet } from "./model";

describe("emergency draft sheet", () => {
  it("uses real FP projections and the shared value calculation with ESPN defaults", () => {
    const bundle = buildAggregateBundle({ scoring: "ppr", teams: 12, rosterSlots: WIFE_RULES.roster });
    const fp = readPublishedFantasyProsProjections();
    const stats = new Map(fp.rows.map(row => [`${normalizePlayerName(row.name)}:${row.position}`, row.stats]));
    const rank = { tier: 1, overall: 2, flex: 1, ecr: 10, adp: 12 };
    const data = SheetDataSchema.parse({ season: "2026", fpDate: fp.updatedAt, sleeperDate: bundle.draftProjections!.fetchedAt, rankingsDate: fp.updatedAt,
      players: (["QB", "RB", "WR", "TE", "K", "DEF"] as const).flatMap(pos => bundle.shards[pos].flatMap(p => {
        const projection = ["K", "DEF"].includes(pos) ? bundle.draftProjections!.players[p.player_id]?.stats : stats.get(`${normalizePlayerName(p.name)}:${pos}`);
        return projection ? [{ id: p.player_id, name: p.name, pos, team: p.team, bye: p.bye_week, status: null, stats: projection, ranks: { std: rank, half: rank, ppr: rank } }] : [];
      })) });
    const original = calculateSheet(data, WIFE_RULES);
    const scoringRules = { ...DEFAULT_DRAFT_SCORING_RULES, ...WIFE_RULES.scoring };
    const points = data.players.map(p => ({ playerId: p.id, position: p.pos, projectedPoints: calculateBeerPlusProjectedPoints({ position: p.pos, stats: p.stats!, scoringRules }) }));
    const shared = buildStarterAwareValues({ teams: 12, rosterSlots: WIFE_RULES.roster, players: points });
    for (const row of original) expect(row.val).toBe(shared.valuesByPlayerId[row.id]?.value);
    const changed = calculateSheet(data, { ...WIFE_RULES, scoring: { ...WIFE_RULES.scoring, reception: 0 } });
    const receiver = data.players.find(p => p.pos === "WR" && (p.stats?.rec ?? 0) > 50)!;
    expect(original.find(p => p.id === receiver.id)!.pts! - changed.find(p => p.id === receiver.id)!.pts!).toBeCloseTo(receiver.stats!.rec!);
    expect(calculateDraftRounds(WIFE_RULES.roster)).toBe(16);
    expect(WIFE_RULES.slot).toBe(7);
  });
  it("rejects invalid saved rules and retains marks when restoring defaults", () => {
    expect(RulesSchema.safeParse({ ...WIFE_RULES, teams: 6 }).success).toBe(false);
    expect(RulesSchema.safeParse({ ...WIFE_RULES, scoring: {} }).success).toBe(false);
    expect(SavedSchema.safeParse({ version: 1, rules: WIFE_RULES, marks: { x: "draft" } }).success).toBe(false);
    const saved = SavedSchema.parse({ version: 1, rules: WIFE_RULES, marks: { x: "mine" } });
    expect(saved.marks).toEqual({ x: "mine" });
  });
});
