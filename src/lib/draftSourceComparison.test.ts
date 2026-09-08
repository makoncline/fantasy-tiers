import { buildDraftValueBoard } from "./draftValue";
import { describe, expect, it } from "vitest";
import { buildAggregateBundle } from "./aggregateBundle";
import { draftCandidateMapFromBundle } from "./draftCandidate";
import { DEFAULT_DRAFT_ROSTER_SLOTS, DEFAULT_DRAFT_SCORING_RULES } from "./draftLeagueConfig";
import { draftReadinessShardCountsFromBundle } from "./draftReadiness";
import { createDefaultSimDraftConfig, createSimDraft, toSleeperDraftDetails } from "./simDraft";
import { buildDraftViewModel, selectDraftSource } from "./draftState";
import { compareDraftSources, ProjectionSourceSchema } from "./draftSourceComparison";
function sourceFixture(snapshot: ReturnType<typeof fixture>["snapshot"]) {
  return ProjectionSourceSchema.parse({ updatedAt: "2026-09-07", problems: [], rows: snapshot.boardInput.players.filter(p => ["QB","RB","WR","TE"].includes(p.position)).map((p,i) => ({ name: p.name, position:p.position, stats: { rush_yd: 2000 / (1+i/100), rec: 30 } })) });
}
function fixture() {
  const bundle = buildAggregateBundle({ scoring: "half", teams: 12, rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS });
  const config = createDefaultSimDraftConfig({ userSlot: 4, scoringRules: DEFAULT_DRAFT_SCORING_RULES });
  const input = {
    playersMap: draftCandidateMapFromBundle(bundle),
    draft: toSleeperDraftDetails(createSimDraft(config)),
    picks: [], userId: config.userId,
    scoringRules: config.scoringRules,
    projectionArtifact: bundle.draftProjections,
    sourceHealth: bundle.sourceHealth ?? null,
    shardCounts: draftReadinessShardCountsFromBundle(bundle),
    evaluationNow: new Date(Math.max(...(bundle.sourceHealth?.sources.map((s) => Date.parse(s.fetchedAt ?? "")) ?? []).filter(Number.isFinite)) + 60_000),
  };
  const view = buildDraftViewModel(input);
  if (!view.choiceSnapshot || !view.recommendationBoard) throw new Error("Fixture is not ready");
  return { input, snapshot: view.choiceSnapshot, board: view.recommendationBoard };
}

describe("separate projection values", { timeout: 20000 }, () => {
  it("preserves source points, rebuilds Adj, and leaves the canonical board unchanged", () => {
    const { snapshot, board } = fixture();
    const before = JSON.stringify({snapshot,board});
    const fp = sourceFixture(snapshot);
    const result = compareDraftSources(snapshot, fp, Date.parse("2026-09-07T18:00:00Z"));
    expect(result.problems).toEqual([]);
    expect(result.fp).not.toBeNull();
    const id = board.topRecommendation!.player.player_id;
    expect(result.sleeper.values.valuesByPlayerId[id]?.projectedPoints).toBe(snapshot.values.valuesByPlayerId[id]?.rawProjectedPoints);
    expect(result.fp?.values.valuesByPlayerId[id]?.projectedPoints).not.toBe(result.sleeper.values.valuesByPlayerId[id]?.projectedPoints);
    expect(result.fp?.board.metricsByPlayerId[id]?.staticValue).toBeCloseTo(result.fp!.values.valuesByPlayerId[id]!.value,0);
    expect(JSON.stringify({snapshot,board})).toBe(before);
  });
  it("does not substitute Sleeper values for stale or incomplete FP projections", () => {
    const { snapshot } = fixture();
    const fp = sourceFixture(snapshot);
    const stale = compareDraftSources(snapshot, {...fp,updatedAt:"2026-07-02"},Date.parse("2026-09-07T18:00:00Z"));
    expect(stale.fp).toBeNull();
    expect(Object.keys(stale.sleeper.values.valuesByPlayerId).length).toBeGreaterThan(100);
    const partial = compareDraftSources(snapshot,{...fp,rows:fp.rows.slice(0,10)},Date.parse("2026-09-07T18:00:00Z"));
    expect(partial.fp).toBeNull();
    expect(partial.problems.join(" ")).toContain("coverage");
  });
});


it("selects source-native points through the canonical model and blocks invalid FP without switching sources", () => {
  const { input, snapshot } = fixture();
  const evaluationNow = input.evaluationNow;
  const fpSource = { ...sourceFixture(snapshot), updatedAt: evaluationNow.toISOString().slice(0,10) };
  const sleeper = buildDraftViewModel({ ...input, evaluationNow, fpSource, valueSource: "sleeper" });
  const fp = buildDraftViewModel({ ...input, evaluationNow, fpSource, valueSource: "fp" });
  expect(sleeper.draftValueStatus.available).toBe(true);
  expect(fp.draftValueStatus.available).toBe(true);
  // Display selection must retain the prepared objects, not score a new board.
  const selectedFp = selectDraftSource(sleeper, "fp");
  expect(selectedFp.recommendationBoard).toBe(sleeper.sourceViews.fp.recommendationBoard);
  expect(selectedFp.choiceSnapshot).toBe(sleeper.sourceViews.fp.choiceSnapshot);
  expect(selectedFp.draftRawValuesByPlayerId).toBe(sleeper.sourceViews.fp.draftRawValuesByPlayerId);
  expect(selectedFp.draftContext).toBe(sleeper.sourceViews.fp.draftContext);
  expect(selectedFp.recommendationBoard).toEqual(fp.recommendationBoard);
  expect(buildDraftValueBoard(fp.choiceSnapshot!.boardInput)).toEqual(fp.recommendationBoard);
  expect(buildDraftValueBoard(sleeper.choiceSnapshot!.boardInput)).toEqual(sleeper.recommendationBoard);
  for (const player of fp.recommendationBoard!.recommendations) {
    expect(fp.choiceSnapshot!.boardInput.qualityRanksByPlayerId?.[player.player_id]).toBe(player.fp_rank_ave);
  }
  expect(sleeper.choiceSnapshot!.boardInput.qualityRanksByPlayerId).toEqual(sleeper.sourceComparison!.sleeper.positionRanksByPlayerId);
  expect(sleeper.choiceSnapshot!.boardInput.qualityRanksByPlayerId).not.toEqual(fp.choiceSnapshot!.boardInput.qualityRanksByPlayerId);

  expect(selectDraftSource(selectedFp, "sleeper").recommendationBoard).toBe(sleeper.recommendationBoard);

  const id = fp.recommendationBoard!.topRecommendation!.player.player_id;
  expect(fp.choiceSnapshot!.values.valuesByPlayerId[id]).toEqual(fp.sourceComparison!.fp!.values.valuesByPlayerId[id]);
  expect(fp.choiceSnapshot!.values.valuesByPlayerId[id]?.projectedPoints).not.toBe(sleeper.choiceSnapshot!.values.valuesByPlayerId[id]?.projectedPoints);
  const comparison = compareDraftSources(fp.choiceSnapshot!, fpSource, evaluationNow.getTime());
  expect(comparison.sleeper.values).toEqual(sleeper.choiceSnapshot!.values);
  const defense = Object.keys(fp.choiceSnapshot!.values.valuesByPlayerId).find(id => input.playersMap[id]?.position === "DEF");
  expect(defense).toBeTruthy();
  expect(fp.choiceSnapshot!.values.valuesByPlayerId[defense!]?.projectedPoints).toBe(sleeper.choiceSnapshot!.values.valuesByPlayerId[defense!]?.projectedPoints);
  for (const badSource of [{...fpSource, updatedAt:"2026-01-01"}, {...fpSource, rows:fpSource.rows.slice(0,10)}]) {
    const blocked = buildDraftViewModel({...input, evaluationNow, fpSource:badSource, valueSource:"fp"});
    expect(blocked.valueSource).toBe("fp");
    expect(blocked.draftValueStatus.available).toBe(false);
    expect(blocked.recommendationBoard).toBeNull();
  }
}, 20000);
