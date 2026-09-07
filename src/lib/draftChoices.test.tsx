/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ChoiceComparison from "@/app/draft-assistant/_components/ChoiceComparison";
import { DraftDataStaticProvider } from "@/app/draft-assistant/_contexts/DraftDataContext";
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
  it("renders the shared comparison and runs advisory stress tests without changing its lean", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const { snapshot } = fixture();
    snapshot.boardInput.currentPick = 4;
    const board = buildDraftValueBoard(snapshot.boardInput);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(
      <DraftDataStaticProvider value={{ recommendationBoard: board, choiceSnapshot: snapshot }}>
        <ChoiceComparison />
      </DraftDataStaticProvider>
    ));
    const currentCard = () => [...(host.querySelector('[data-testid="decision-recommendation-card"]')?.querySelectorAll("h3, dl") ?? [])].map((node) => node.textContent).join(" ");
    const first = currentCard();
    expect(first).toContain(board.topRecommendation?.player.name);
    expect(host.querySelector('[data-testid="next-pick-scenario"]')).toBeNull();
    const preview = [...host.querySelectorAll("button")].find((b) => b.textContent === "Show next-pick scenario");
    act(() => preview?.click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(host.querySelector('[data-testid="next-pick-scenario"]')).not.toBeNull();
    expect(currentCard()).toBe(first);
    const refreshed = { ...snapshot };
    act(() => root.render(
      <DraftDataStaticProvider value={{ recommendationBoard: board, choiceSnapshot: refreshed }}>
        <ChoiceComparison />
      </DraftDataStaticProvider>
    ));
    expect(host.querySelector('[data-testid="next-pick-scenario"]')).toBeNull();
    expect(host.textContent).toContain("The board changed");
    const diagnostics = [...host.querySelectorAll("button")].find((b) => b.textContent === "Details, assumptions & notes");
    act(() => diagnostics?.click());
    expect(host.textContent).toContain("Insufficient evidence");
    const test = [...host.querySelectorAll("button")].find((b) => b.textContent === "Test assumptions for this pick");
    act(() => test?.click());
    expect(host.querySelector('[data-testid="choice-sensitivity"]')).not.toBeNull();
    expect(currentCard()).toBe(first);
    expect(host.textContent).toContain("Tested winners:");
    expect(host.textContent).not.toContain("Set membership only");
    expect(host.textContent).not.toContain("Highest Adj in this row");
    const details = [...host.querySelectorAll("button")].find((b) => b.textContent === "Value and adjustment details");
    act(() => details?.click());
    expect(host.textContent).toContain("Original league-scored projection");
    const adjacent = { ...snapshot, boardInput: { ...snapshot.boardInput, currentPick: 24, userSlot: 1 } };
    const adjacentBoard = buildDraftValueBoard(adjacent.boardInput);
    const savedBoard = JSON.stringify(adjacentBoard);
    act(() => root.render(
      <DraftDataStaticProvider value={{ recommendationBoard: adjacentBoard, choiceSnapshot: adjacent }}>
        <ChoiceComparison />
      </DraftDataStaticProvider>
    ));
    expect(host.textContent).toContain("Back-to-back picks");
    expect(host.textContent).not.toContain("May be gone");
    expect(JSON.stringify(adjacentBoard)).toBe(savedBoard);
    const offClock = { ...snapshot, boardInput: { ...snapshot.boardInput, currentPick: 3, userSlot: 4 } };
    act(() => root.render(
      <DraftDataStaticProvider value={{ recommendationBoard: buildDraftValueBoard(offClock.boardInput), choiceSnapshot: offClock }}>
        <ChoiceComparison />
      </DraftDataStaticProvider>
    ));
    expect(host.textContent).not.toContain("Back-to-back picks");
    expect(host.textContent).toContain("Upcoming · 1.04");
    const unknown = { ...snapshot, boardInput: { ...snapshot.boardInput, currentPick: 12, userSlot: 12, rounds: undefined } };
    act(() => root.render(
      <DraftDataStaticProvider value={{ recommendationBoard: buildDraftValueBoard(unknown.boardInput), choiceSnapshot: unknown }}>
        <ChoiceComparison />
      </DraftDataStaticProvider>
    ));
    expect(host.textContent).toContain("Draft turn information is incomplete");
    expect(host.textContent).not.toContain("Back-to-back picks");
    expect(host.textContent).not.toContain("No later own pick");
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });
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
