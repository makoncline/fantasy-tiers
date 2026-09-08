import { describe, expect, it } from "vitest";
import { EspnRoomSchema, espnRoomStatus } from "./schemas";
import { espnDraftConfig, mapEspnDraft } from "./adapter";
import { applyEspnMessage } from "./protocol";
import { AggregatesBundlePlayer, AggregatesBundleResponse } from "@/lib/schemas-bundle";
import { draftCandidateMapFromBundle } from "@/lib/draftCandidate";
import { buildStarterAwareStrategy } from "@/lib/beerPlusStrategy";

function fixture() {
  const player = (id: string, name: string, rank: number) => AggregatesBundlePlayer.parse({
    player_id: id, name, position: "WR", team: "SEA", bye_week: 11, tiers: { rank, tier: 1 },
    sleeper: Object.fromEntries(["rank", "adp", "boardValue", "pts", "depthChartPosition", "depthChartOrder", "injuryStatus", "injuryNotes"].map((key) => [key, null])),
    fantasypros: { rank, tier: 1, pos_rank: `WR${rank}`, ecr: rank, ecr_average: rank, ecr_std: null, ecr_round_pick: null, pts: null, baseline_pts: null, adp: null, player_owned_avg: null },
    calc: { value: null, positional_scarcity: null, market_delta: null },
  });
  const rows = [player("shared-a", "First Player", 1), player("shared-b", "Second Player", 2)];
  const bundle = AggregatesBundleResponse.parse({ lastModified: null, scoring: "ppr", teams: 2, roster: { QB: 0, RB: 0, WR: 1, TE: 0, K: 0, DEF: 0, FLEX: 0, BENCH: 1 }, shards: { ALL: rows, WR: rows.map((r) => ({ ...r, tiers: { rank: r.tiers.rank, tier: 2 } })), QB: [], RB: [], TE: [], K: [], DEF: [], FLEX: rows } });
  const room = EspnRoomSchema.parse({ connected: true, updatedAt: Date.now(), error: null,
    data: { observedAt: Date.now(), leagueId: 99, season: 2026, name: "Test practice", draftType: "SNAKE", practice: true, rankType: "PPR", scoringItems: [{ statId: 53, points: 1, pointsOverrides: {} }], teams: [{ id: 12, name: "One" }, { id: 7, name: "Two" }], players: rows.map((r, index) => ({ id: 101 + index, name: r.name, positionId: 3, proTeamId: 26, eligibleSlots: [4, 23], rank: 4 + index, adp: 6 + index, projected: 300 - index * 20 })) },
    live: { leagueId: 99, teamId: 7, state: 3, draftType: 1, limits: [], slots: [{ id: 1, category: 4, positions: [3] }, { id: 2, category: 20, positions: [3] }], teams: [{ id: 12, draftPosition: 0 }, { id: 7, draftPosition: 1 }], picks: [12, 7, 7, 12].map((teamId, i) => ({ teamId, pickNumber: i + 1, playerId: i === 0 ? 101 : -1, slotId: 1, keeper: false })) },
  });
  return { room, bundle };
}

describe("ESPN shared-model adapter", () => {
  it("maps a live snake pick to shared identity, order, shards, and shared source inputs", () => {
    const { room, bundle } = fixture();
    room.live = applyEspnMessage(room.live, "SELECTED 7 102 1");
    const mapped = mapEspnDraft(room, bundle);
    expect(mapped.picks).toEqual([{ player_id: "shared-a", pick_no: 1, round: 1, draft_slot: 1 }, { player_id: "shared-b", pick_no: 2, round: 1, draft_slot: 2 }]);
    expect(mapped.details.draft_order[mapped.userId]).toBe(2);
    expect(mapped.bundle.shards.WR[0]?.tiers.tier).toBe(2);
    expect(mapped.bundle.shards.ALL[0]?.tiers.tier).toBe(1);
    const candidates = Object.values(draftCandidateMapFromBundle(mapped.bundle));
    expect(candidates[0]?.sleeper_adp).toBeNull();
    // Mapping keeps source values and position shards without mutating the cache.
    expect(mapped.bundle.shards.WR[0]).toBe(bundle.shards.WR[0]);
    expect(mapped.bundle.draftProjections?.source).toBe("ESPN league projections");
    expect(mapped.bundle.draftProjections?.leaguePoints?.points["shared-a"]).toBe(300);
    expect(mapped.scoringRules.reception).toBe(1);

  });

  it("uses ESPN league totals for D/ST and leaves missing projections missing", () => {
    const { room, bundle } = fixture();
    if (!room.data || !room.live) throw new Error("Missing fixture room");
    const defense = { ...bundle.shards.ALL[0]!, player_id: "BUF", name: "Buffalo Bills", position: "DEF" };
    bundle.shards.ALL.push(defense);
    bundle.shards.DEF.push(defense);
    room.data.players.push({ ...room.data.players[0]!, id: 999, name: "Bills D/ST", positionId: 16, projected: 112 });
    room.live.slots[1] = { id: 2, category: 16, positions: [16] };
    const mapped = mapEspnDraft(room, bundle);
    const players = Object.values(draftCandidateMapFromBundle(mapped.bundle)).map((player) => ({ playerId: player.player_id, position: player.position, ecr: player.fp_rank_ave }));
    const strategy = buildStarterAwareStrategy({ artifact: mapped.bundle.draftProjections!, players, teams: mapped.teams, rounds: mapped.rounds, rosterSlots: mapped.rosterSlots, scoringRules: mapped.scoringRules });
    expect(strategy.status.available).toBe(true);
    expect(strategy.status.capabilityLimitations).toEqual([]);
    expect(strategy.result?.valuesByPlayerId.BUF?.rawProjectedPoints).toBe(112);
    expect(mapped.bundle.draftProjections?.fetchedAt).toBe(new Date(room.data.observedAt).toISOString());
    expect(mapped.bundle.draftProjections?.sourceLastModified).toBeNull();
    room.data.players.find((player) => player.id === 999)!.projected = null;
    const missing = mapEspnDraft(room, bundle);
    expect(missing.bundle.draftProjections?.leaguePoints?.points.BUF).toBeUndefined();
    expect(buildStarterAwareStrategy({ artifact: missing.bundle.draftProjections!, players, teams: mapped.teams, rounds: mapped.rounds, rosterSlots: mapped.rosterSlots, scoringRules: mapped.scoringRules }).status.available).toBe(false);
  });

  it("excludes unmatched candidates from every shard without changing the source pool", () => {
    const { room, bundle } = fixture();
    if (!room.data) throw new Error("Missing fixture data");
    room.data.players = room.data.players.filter((player) => player.id === 101);
    const mapped = mapEspnDraft(room, bundle);
    expect(Object.keys(draftCandidateMapFromBundle(mapped.bundle))).toEqual(["shared-a"]);
    for (const rows of Object.values(mapped.bundle.shards)) {
      expect(rows.every((row) => row.player_id === "shared-a")).toBe(true);
    }
    expect(bundle.shards.ALL.map((row) => row.player_id)).toEqual(["shared-a", "shared-b"]);
    expect(mapped.bundle.shards.WR[0]).toBe(bundle.shards.WR[0]);
  });

  it("stops advice for position scoring overrides but permits overrides equal to the base rate", () => {
    const { room, bundle } = fixture();
    const reception = room.data?.scoringItems[0];
    if (!reception) throw new Error("Missing fixture scoring");
    reception.pointsOverrides = { "4": 1.5 };
    expect(() => espnDraftConfig(room)).toThrow("position-specific scoring");
    expect(() => mapEspnDraft(room, bundle)).toThrow("position-specific scoring");
    reception.pointsOverrides = { "4": 1 };
    expect(mapEspnDraft(room, bundle).scoringRules.reception).toBe(1);
  });

  it("stops on unknown drafted players, order gaps, and stale connections", () => {
    const { room, bundle } = fixture();
    room.live = applyEspnMessage(room.live, "SELECTED 7 999 1");
    expect(() => mapEspnDraft(room, bundle)).toThrow("no ranking match");
    room.live = applyEspnMessage(room.live, "UNDONE 1");
    expect(espnRoomStatus(room, room.updatedAt + 16000)).toContain("Connection lost");
    if (room.live) room.live.picks[1]!.playerId = 102;
    expect(() => mapEspnDraft(room, bundle)).toThrow("gap");
  });
});
