/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { buildAggregateBundle } from "./aggregateBundle";
import { draftCandidateMapFromBundle } from "./draftCandidate";
import { DEFAULT_DRAFT_ROSTER_SLOTS, DEFAULT_DRAFT_SCORING_RULES } from "./draftLeagueConfig";
import { draftReadinessShardCountsFromBundle } from "./draftReadiness";
import { createDefaultSimDraftConfig, createSimDraft, toSleeperDraftDetails } from "./simDraft";
import { buildDraftViewModel } from "./draftState";
import { buildDraftValueBoard, getNextPickForSlot } from "./draftValue";
import { buildDraftChoices, choiceRosterFit, type DraftChoiceSnapshot } from "./draftChoices";
import { analyzeDraftChoiceSensitivity, DraftChoiceSensitivitySchema } from "./draftChoiceSensitivity";

function fixture() {
  const bundle = buildAggregateBundle({ scoring: "half", teams: 12, rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS });
  const config = createDefaultSimDraftConfig({ userSlot: 4, scoringRules: DEFAULT_DRAFT_SCORING_RULES });
  const view = buildDraftViewModel({
    playersMap: draftCandidateMapFromBundle(bundle),
    draft: toSleeperDraftDetails(createSimDraft(config)),
    picks: [], userId: config.userId,
    scoringRules: config.scoringRules,
    projectionArtifact: bundle.draftProjections,
    sourceHealth: bundle.sourceHealth ?? null,
    shardCounts: draftReadinessShardCountsFromBundle(bundle),
    evaluationNow: new Date(Math.max(...(bundle.sourceHealth?.sources.map((s) => Date.parse(s.fetchedAt ?? "")) ?? []).filter(Number.isFinite)) + 60_000),
  });
  if (!view.choiceSnapshot || !view.recommendationBoard) throw new Error("Fixture is not ready");
  return { snapshot: view.choiceSnapshot, board: view.recommendationBoard };
}

describe("advisory draft choices", { timeout: 20_000 }, () => {
  it("runs canonical stress cases without changing the board or league inputs", () => {
    const { snapshot, board } = fixture();
    const before = JSON.stringify({ snapshot, board });
    const choices = buildDraftChoices(board);
    expect(choices[0]?.player.player_id).toBe(board.topRecommendation?.player.player_id);
    const report = DraftChoiceSensitivitySchema.parse(analyzeDraftChoiceSensitivity(snapshot));
    expect(report.scenarios).toHaveLength(6);
    expect(report.scenarios.every((s) => s.leanId && s.choiceIds.includes(s.leanId))).toBe(true);
    expect(JSON.stringify({ snapshot, board })).toBe(before);
    expect(buildDraftValueBoard(snapshot.boardInput).recommendations).toEqual(board.recommendations);
  });

  it("finds a base-value disagreement outside the first twelve adjusted options", () => {
    const { board } = fixture();
    const target = board.recommendations[20]!;
    const copy = structuredClone(board);
    copy.metricsByPlayerId[target.player_id]!.staticValue = 10_000;
    const choices = buildDraftChoices(copy);
    expect(choices[0]?.player.player_id).toBe(board.topRecommendation?.player.player_id);
    expect(choices.some((c) => c.player.player_id === target.player_id)).toBe(true);
  });

  it("preserves the final required defense under every stress case and accounts for both FLEX slots", () => {
    const { snapshot } = fixture();
    const final: DraftChoiceSnapshot = { ...snapshot, boardInput: {
      ...snapshot.boardInput, currentPick: 165, userSlot: 4, rounds: 14,
      userPositionCounts: { QB: 1, TE: 1, RB: 5, WR: 6, DEF: 0 },
      userPositionNeeds: { QB: 0, TE: 0, RB: 0, WR: 0, FLEX: 0, DEF: 1, BN: 0 },
    } };
    const board = buildDraftValueBoard(final.boardInput);
    expect(buildDraftChoices(board).every((c) => c.player.position === "DEF")).toBe(true);
    const report = analyzeDraftChoiceSensitivity(final);
    expect(report.scenarios.every((s) => s.path === "DEF starter slot")).toBe(true);
    expect(getNextPickForSlot({ ...final.boardInput, currentPick: 166 })).toBeNull();
    expect(board.topRecommendation?.metrics.components.timing).toBe(0);
    expect(choiceRosterFit({ position: "WR" }, { FLEX: 2, DEF: 1 })).toMatchObject({ slot: "FLEX", remaining: "Still open: 1 FLEX, 1 DEF." });
    expect(choiceRosterFit({ position: "RB" }, { FLEX: 1 })).toMatchObject({ slot: "FLEX", remaining: "All starting slots are covered." });
  });
});
