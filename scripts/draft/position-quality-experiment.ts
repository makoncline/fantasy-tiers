import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { buildDraftState } from "../../src/lib/draftState";
import { projectionPositionRanks } from "../../src/lib/draftSourceComparison";
import { DraftCandidateSchema } from "../../src/lib/draftCandidate";
import { buildDraftValueBoard } from "../../src/lib/draftValue";
import { DraftRosterSlotsSchema, DraftScoringRulesSchema } from "../../src/lib/draftLeagueConfig";
import { buildRosterRequirementsFromDraftSettings, calculateTeamNeedsAndCountsForSingleTeam, calculateTotalRemainingNeeds } from "../../src/lib/draftHelpers";
import { advanceUntilUserTurn, createDefaultSimDraftConfig, createSimDraft, getSimDraftSnapshot, makeUserPick, toSleeperDraftDetails, type SimDraftPlayer } from "../../src/lib/simDraft";
import { POSITION_POLICIES, selectPositionPolicy } from "./position-quality-policy";

const Snapshot = z.object({
  scoringRules: DraftScoringRulesSchema, rosterSlots: DraftRosterSlotsSchema,
  projectionUpdatedAt: z.string().nullable(),
  boardInput: z.object({ players: z.array(DraftCandidateSchema), staticValuesByPlayerId: z.record(z.string(), z.number()) }),
  values: z.object({ valuesByPlayerId: z.record(z.string(), z.object({ projectedPoints: z.number(), value: z.number() })) }),
});
const Input = z.object({ sourceViews: z.object({ fp: z.object({ choiceSnapshot: Snapshot }), sleeper: z.object({ choiceSnapshot: Snapshot }) }) });
const inputPath = process.argv[2];
const output = process.argv[3];
if (!inputPath || !output) throw new Error("Usage: position-quality-experiment.ts FROZEN_PREFLIGHT OUTPUT_DIR [smoke]");
const raw = fs.readFileSync(inputPath, "utf8");
const frozen = Input.parse(JSON.parse(raw));
const fp = frozen.sourceViews.fp.choiceSnapshot;
const sleeper = frozen.sourceViews.sleeper.choiceSnapshot;
if (JSON.stringify(fp.scoringRules) !== JSON.stringify(sleeper.scoringRules)) throw new Error("Scoring mismatch");
const hash = createHash("sha256").update(raw).digest("hex");
fs.mkdirSync(output, { recursive: true });
const selectedSource = process.argv[4] === "canonical-sleeper" ? "sleeper" : "fp";
const selectedSnapshot = selectedSource === "fp" ? fp : sleeper;
const candidates = fp.boardInput.players;
const qualityRanksByPlayerId = selectedSource === "fp"
  ? Object.fromEntries(candidates.flatMap(p => p.fp_rank_ave != null ? [[p.player_id, p.fp_rank_ave]] : []))
  : projectionPositionRanks(candidates.flatMap(p => {
      const points = sleeper.values.valuesByPlayerId[p.player_id]?.projectedPoints;
      return points == null ? [] : [{ playerId: p.player_id, position: p.position, projectedPoints: points }];
    }));
// Keep the complete frozen pool. Bot market rank is separate from our ECR eligibility.
const players: SimDraftPlayer[] = candidates.map(p => ({ ...p, rank: p.rank ?? 9999,
  tier: p.tier ?? 9999, sleeperAdp: p.sleeper_adp, sleeperRank: p.sleeper_board_rank }));
const playerMap = new Map(candidates.map(p => [p.player_id, p]));
const cases = process.argv[4] === "smoke" ? [{ slot: 4, seed: 1 }] : [
  ...Array.from({ length: 12 }, (_, i) => i + 1).flatMap(slot => [1, 2, 3].map(seed => ({ slot, seed }))),
  ...[4, 5, 6].map(seed => ({ slot: 4, seed })),
];
const summaries = [];
for (const test of cases) {
  for (const policy of POSITION_POLICIES.filter(p => process.argv[4]?.startsWith("canonical") ? p === "baseline" : process.argv[4] === "position-timing" ? p === "position-timing" : p !== "position-timing")) {
    const config = createDefaultSimDraftConfig({ teams: 12, userSlot: test.slot, draftType: "snake",
      rosterSlots: fp.rosterSlots, scoringRules: fp.scoringRules,
      seed: `position-quality-${test.seed}-slot-${test.slot}`, botStrategy: "sleeper-market-v1" });
    const requirements = buildRosterRequirementsFromDraftSettings(toSleeperDraftDetails(createSimDraft(config)).settings);
    let state = advanceUntilUserTurn(createSimDraft(config), players);
    const decisions = [];
    let previousLeaders: Record<string, string> = {};
    while (state.status !== "complete") {
      const base = buildDraftState({ playersMap: Object.fromEntries(playerMap), draft: toSleeperDraftDetails(state), picks: state.picks });
      const rosterStates = Array.from({ length: config.teams }, (_, i) => {
        const roster = base.drafted.filter(p => p.draft_slot === i + 1);
        const { positionCounts, positionNeeds } = calculateTeamNeedsAndCountsForSingleTeam(roster, requirements);
        return { draftSlot: i + 1, positionCounts, starterNeeds: positionNeeds, benchSlotsRemaining: positionNeeds.BN ?? 0 };
      });
      const own = rosterStates[test.slot - 1]!;
      const draftWideNeeds = calculateTotalRemainingNeeds(Object.fromEntries(rosterStates.map(r => [r.draftSlot, {
        remainingPositionRequirements: { QB: r.starterNeeds.QB ?? 0, RB: r.starterNeeds.RB ?? 0, WR: r.starterNeeds.WR ?? 0, TE: r.starterNeeds.TE ?? 0, K: r.starterNeeds.K ?? 0, DEF: r.starterNeeds.DEF ?? 0 },
      }])));
      const board = buildDraftValueBoard({ players: Object.values(base.players).map(p => ({ ...p, draftedByMe: p.drafted && p.draft_slot === test.slot })),
        teams: 12, rounds: config.rounds, draftType: "snake", currentPick: state.picks.length + 1, userSlot: test.slot,
        rosterRequirements: requirements, userPositionCounts: own.positionCounts, userPositionNeeds: own.starterNeeds,
        userRosterPlayers: base.drafted.filter(p => p.draft_slot === test.slot), teamRosterStates: rosterStates, draftWideNeeds,
        qualityRanksByPlayerId,
        irSlots: fp.rosterSlots.IR, staticValuesByPlayerId: selectedSnapshot.boardInput.staticValuesByPlayerId });
      const selected = selectPositionPolicy(board, policy);
      if (!selected || !board.topRecommendation) throw new Error(`No pick at ${state.picks.length + 1}`);
      const describe = (id: string) => ({ id, name: playerMap.get(id)?.name, position: playerMap.get(id)?.position,
        tier: board.metricsByPlayerId[id]?.positionTier, ...board.metricsByPlayerId[id] });
      const positionLeaders = Object.fromEntries(
        ["QB", "RB", "WR", "TE", "K", "DEF"].flatMap(position => {
          const leader = board.recommendations.find(p => p.position === position);
          return leader ? [[position, describe(leader.player_id)]] : [];
        })
      );
      const previousPositionLeaders = Object.fromEntries(Object.entries(previousLeaders).map(([position, id]) => [position, {
        ...describe(id),
        drafted: base.players[id]?.drafted === true,
        eligible: board.recommendations.some(p => p.player_id === id),
        sourceRank: qualityRanksByPlayerId[id],
      }]));
      decisions.push({ pick: state.picks.length + 1, baseline: describe(board.topRecommendation.player.player_id),
        positionLeaders, previousPositionLeaders,
        selected: describe(selected.player_id), selectionScore: board.metricsByPlayerId[selected.player_id]!.recommendationScore - (policy === "position-timing" ? board.metricsByPlayerId[selected.player_id]!.components.demand : 0), changed: selected.player_id !== board.topRecommendation.player.player_id });
      previousLeaders = Object.fromEntries(Object.entries(positionLeaders).map(([position, player]) => [position, player.id]));
      state = advanceUntilUserTurn(makeUserPick(state, selected.player_id, players), players);
    }
    const roster = getSimDraftSnapshot(state, players).rostersBySlot[test.slot] ?? [];
    const needs = calculateTeamNeedsAndCountsForSingleTeam(roster, requirements);
    const legal = roster.length === config.rounds && Object.values(needs.positionNeeds).every(n => n === 0) &&
      new Set(state.picks.map(p => p.player_id)).size === 180;
    const evaluate = (source: typeof fp) => {
      const entries = roster.map(p => ({ id: p.player_id, position: p.position, ...source.values.valuesByPlayerId[p.player_id] }));
      const used = new Set<string>();
      const take = (positions: string[], count: number) => {
        const chosen = entries.filter(p => !used.has(p.id) && positions.includes(p.position)).sort((a, b) => (b.projectedPoints ?? -Infinity) - (a.projectedPoints ?? -Infinity)).slice(0, count);
        chosen.forEach(p => used.add(p.id)); return chosen;
      };
      const starters = (["QB", "RB", "WR", "TE", "K", "DEF"] as const).flatMap(pos => take([pos], requirements[pos]));
      const flex = take(["RB", "WR", "TE"], requirements.FLEX);
      const depth = entries.filter(p => !used.has(p.id));
      const sum = (rows: typeof entries) => entries.every(p => p.projectedPoints != null) ? rows.reduce((s, p) => s + p.projectedPoints!, 0) : null;
      return { starters: sum(starters), flex: sum(flex), depth: sum(depth),
        positiveValueDepth: depth.filter(p => p.value != null && p.value > 0).length,
        missingProjectionIds: entries.filter(p => p.projectedPoints == null).map(p => p.id) };
    };
    const summary = { ...test, policy, hash, selectedSource, legal, counts: needs.positionCounts,
      ownerPolicy: (needs.positionCounts.QB ?? 0) === 1 && (needs.positionCounts.TE ?? 0) === 1,
      fp: evaluate(fp), sleeper: evaluate(sleeper), changes: decisions.filter(d => d.changed).length,
      roster: roster.map(p => ({ id: p.player_id, name: p.name, position: p.position })),
      valSacrificed: decisions.reduce((s, d) => s + Math.max(0, (d.baseline.staticValue ?? 0) - (d.selected.staticValue ?? 0)), 0) };
    fs.writeFileSync(path.join(output, `${test.slot}-${test.seed}-${policy}.json`), JSON.stringify({ config, summary, decisions, picks: state.picks }));
    summaries.push(summary);
    fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify({ hash, inputPath, method: `${selectedSource}-native canonical scoring, frozen preflight. Separate FP/Sleeper forecast evaluation. Synthetic pressure tests, not outcome proof.`, summaries }, null, 2));
    console.log(`${test.slot}/${test.seed} ${policy}: legal=${legal} changes=${summary.changes}`);
  }
}
