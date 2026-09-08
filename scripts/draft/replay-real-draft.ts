import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { DraftCandidateSchema } from "../../src/lib/draftCandidate";
import { DraftRosterSlotsSchema, DraftScoringRulesSchema } from "../../src/lib/draftLeagueConfig";
import { DraftPicksSchema, type DraftPick } from "../../src/lib/schemas";
import { buildDraftState } from "../../src/lib/draftState";
import { buildDraftValueBoard } from "../../src/lib/draftValue";
import { projectionPositionRanks } from "../../src/lib/draftSourceComparison";
import { calculateTeamNeedsAndCountsForSingleTeam, calculateTotalRemainingNeeds, buildRosterRequirementsFromDraftSettings } from "../../src/lib/draftHelpers";
import { createDefaultSimDraftConfig, createSimDraft, getDraftSlotForPick, toSleeperDraftDetails } from "../../src/lib/simDraft";

const Snapshot = z.object({
  scoringRules: DraftScoringRulesSchema,
  rosterSlots: DraftRosterSlotsSchema,
  boardInput: z.object({
    players: z.array(DraftCandidateSchema), teams: z.number().int().positive(),
    rounds: z.number().int().positive(), userSlot: z.number().int().positive(),
    draftType: z.enum(["snake", "linear"]),
    staticValuesByPlayerId: z.record(z.string(), z.number()),
  }),
  values: z.object({ valuesByPlayerId: z.record(z.string(), z.object({ projectedPoints: z.number() })) }),
});
const Frozen = z.object({ sourceViews: z.object({
  fp: z.object({ choiceSnapshot: Snapshot }), sleeper: z.object({ choiceSnapshot: Snapshot }),
}) });
const [inputFile, picksFile, outputDirectory] = process.argv.slice(2);
if (!inputFile || !picksFile || !outputDirectory) throw new Error("Usage: replay-real-draft.ts PREFLIGHT PICKS OUTPUT_DIRECTORY");
const raw = fs.readFileSync(inputFile, "utf8");
const frozen = Frozen.parse(JSON.parse(raw));
const actual = DraftPicksSchema.parse(JSON.parse(fs.readFileSync(picksFile, "utf8"))).sort((a, b) => a.pick_no - b.pick_no);
const fp = frozen.sourceViews.fp.choiceSnapshot;
const { teams, rounds, userSlot, draftType } = fp.boardInput;
const candidates = fp.boardInput.players;
const playersMap = Object.fromEntries(candidates.map(p => [p.player_id, p]));
const lastUserPick = Math.max(...actual.filter(p => p.draft_slot === userSlot).map(p => p.pick_no));
if (actual.length !== teams * rounds || new Set(actual.map(p => p.player_id)).size !== actual.length) throw new Error("Incomplete or duplicate actual picks");
actual.forEach((p, index) => {
  if (p.pick_no !== index + 1 || p.draft_slot !== getDraftSlotForPick(p.pick_no, teams, draftType)) throw new Error(`Invalid pick ${p.pick_no}`);
  // An unmodeled player after the final owner turn cannot affect a recommendation.
  // Retain the observed pick without assigning an invented position or projection.
  if (!playersMap[p.player_id] && p.pick_no <= lastUserPick) throw new Error(`Unmatched player before final owner turn: ${p.pick_no}`);
});
const config = createDefaultSimDraftConfig({ teams, userSlot, draftType, rosterSlots: fp.rosterSlots, scoringRules: fp.scoringRules });
if (config.rounds !== rounds) throw new Error("Roster and round count mismatch");
const draft = toSleeperDraftDetails(createSimDraft(config));
const requirements = buildRosterRequirementsFromDraftSettings(draft.settings);
fs.mkdirSync(outputDirectory, { recursive: true });
const results = [];
for (const source of ["fp", "sleeper"] as const) {
  const snapshot = frozen.sourceViews[source].choiceSnapshot;
  if (JSON.stringify(snapshot.scoringRules) !== JSON.stringify(fp.scoringRules)) throw new Error("Source scoring mismatch");
  const qualityRanksByPlayerId = source === "fp"
    ? Object.fromEntries(candidates.flatMap(p => p.fp_rank_ave != null ? [[p.player_id, p.fp_rank_ave]] : []))
    : projectionPositionRanks(candidates.flatMap(p => {
      const points = snapshot.values.valuesByPlayerId[p.player_id]?.projectedPoints;
      return points == null ? [] : [{ playerId: p.player_id, position: p.position, projectedPoints: points }];
    }));
  for (const mode of ["actual-board", "counterfactual"] as const) {
    const picks: DraftPick[] = [];
    const decisions = [];
    const opponentReplacements = [];
    for (const original of actual) {
      const draftedIds = new Set(picks.map(p => p.player_id));
      let selectedId = original.player_id;
      if (original.draft_slot === userSlot) {
        const state = buildDraftState({ playersMap, draft, picks });
        const teamRosterStates = Array.from({ length: teams }, (_, i) => {
          const roster = state.drafted.filter(p => p.draft_slot === i + 1);
          const { positionCounts, positionNeeds } = calculateTeamNeedsAndCountsForSingleTeam(roster, requirements);
          return { draftSlot: i + 1, positionCounts, starterNeeds: positionNeeds, benchSlotsRemaining: positionNeeds.BN ?? 0 };
        });
        const own = teamRosterStates[userSlot - 1]!;
        const draftWideNeeds = calculateTotalRemainingNeeds(Object.fromEntries(teamRosterStates.map(r => [r.draftSlot, {
          remainingPositionRequirements: { QB: r.starterNeeds.QB ?? 0, RB: r.starterNeeds.RB ?? 0, WR: r.starterNeeds.WR ?? 0, TE: r.starterNeeds.TE ?? 0, K: r.starterNeeds.K ?? 0, DEF: r.starterNeeds.DEF ?? 0 },
        }])));
        const board = buildDraftValueBoard({
          players: Object.values(state.players).map(p => ({ ...p, draftedByMe: p.drafted && p.draft_slot === userSlot })),
          teams, rounds, userSlot, draftType, currentPick: original.pick_no,
          rosterRequirements: requirements, userPositionCounts: own.positionCounts, userPositionNeeds: own.starterNeeds,
          userRosterPlayers: state.drafted.filter(p => p.draft_slot === userSlot), teamRosterStates, draftWideNeeds,
          irSlots: fp.rosterSlots.IR, staticValuesByPlayerId: snapshot.boardInput.staticValuesByPlayerId, qualityRanksByPlayerId,
        });
        const top = board.topRecommendation;
        if (!top || draftedIds.has(top.player.player_id)) throw new Error(`No available recommendation at ${original.pick_no}`);
        decisions.push({ pick: original.pick_no, actual: playersMap[original.player_id]!.name,
          actualId: original.player_id, recommendation: top.player.name, recommendationId: top.player.player_id,
          position: top.player.position, metrics: top.metrics,
          matchesActual: top.player.player_id === original.player_id,
          positionLeaders: Object.fromEntries(["QB", "RB", "WR", "TE", "K", "DEF"].flatMap(position => {
            const p = board.recommendations.find(p => p.position === position);
            return p ? [[position, { name: p.name, id: p.player_id, score: board.metricsByPlayerId[p.player_id]!.recommendationScore }]] : [];
          })),
        });
        if (mode === "counterfactual") selectedId = top.player.player_id;
      } else if (draftedIds.has(selectedId)) {
        // Preserve the opponent's observed position choice. Use only frozen market
        // ranks for a replacement, never that opponent's later observed picks.
        const position = playersMap[selectedId]!.position;
        const replacement = candidates.filter(p => p.position === position && !draftedIds.has(p.player_id))
          .sort((a, b) => (a.sleeper_board_rank ?? a.sleeper_adp ?? Infinity) - (b.sleeper_board_rank ?? b.sleeper_adp ?? Infinity) || a.player_id.localeCompare(b.player_id))[0];
        if (!replacement) throw new Error(`No opponent replacement at ${original.pick_no}`);
        opponentReplacements.push({ pick: original.pick_no, slot: original.draft_slot, original: playersMap[selectedId]!.name, replacement: replacement.name });
        selectedId = replacement.player_id;
      }
      if (draftedIds.has(selectedId)) throw new Error(`Duplicate selected player at ${original.pick_no}`);
      picks.push({ ...original, player_id: selectedId });
    }
    const roster = picks.filter(p => p.draft_slot === userSlot).map(p => ({ ...playersMap[p.player_id]!, pick: p.pick_no }));
    const needs = calculateTeamNeedsAndCountsForSingleTeam(roster, requirements);
    if (mode === "counterfactual" && Object.values(needs.positionNeeds).some(n => n > 0)) throw new Error("Incomplete counterfactual roster");
    const result = { source, mode, inputSha256: createHash("sha256").update(raw).digest("hex"),
      teams, rounds, userSlot, scoringRules: fp.scoringRules, rosterSlots: fp.rosterSlots,
      unmodeledPicksAfterFinalUserTurn: actual.filter(p => !playersMap[p.player_id]),
      decisions, opponentReplacements, picks, roster: roster.map(p => ({ id: p.player_id, name: p.name, position: p.position, pick: p.pick })), counts: needs.positionCounts };
    fs.writeFileSync(path.join(outputDirectory, `${source}-${mode}.json`), JSON.stringify(result, null, 2) + "\n");
    results.push({ source, mode, matches: decisions.filter(d => d.matchesActual).length, opponentReplacements: opponentReplacements.length, roster: result.roster });
    console.log(`${source} ${mode}: ${decisions.length} turns, ${decisions.filter(d => d.matchesActual).length} actual matches, ${opponentReplacements.length} opponent replacements`);
  }
}
fs.writeFileSync(path.join(outputDirectory, "summary.json"), JSON.stringify(results, null, 2) + "\n");
