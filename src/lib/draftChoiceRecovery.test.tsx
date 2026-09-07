/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import ChoiceComparison from "@/app/draft-assistant/_components/ChoiceComparison";
import { DraftOptionalBoundary } from "@/app/draft-assistant/_components/DraftOptionalBoundary";
import { DraftDataStaticProvider } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { draftChoiceFixture } from "./draftChoiceFixture";
import { buildDraftValueBoard } from "./draftValue";
import * as lookahead from "./draftLookahead";
let root: Root | null = null;
let host: HTMLDivElement;
afterEach(() => {
  if (root) act(() => root?.unmount()); root = null;
  host?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
function setup() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  const snapshot = draftChoiceFixture();
  const show = (next = snapshot, onPick?: (player: { player_id: string }) => void) => {
    const board = buildDraftValueBoard({ ...next.boardInput, players: next.boardInput.players.map((player) => ({ ...player, drafted: false, draftedByMe: false })) });
    act(() => root!.render(<DraftDataStaticProvider value={{ choiceSnapshot: next, recommendationBoard: board }}><ChoiceComparison pickAction={onPick ? { onPick } : undefined} /></DraftDataStaticProvider>));
    return board;
  };
  return { snapshot, show };
}
function click(text: string) {
  const button = [...host.querySelectorAll("button")].find(node => node.textContent === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => button.click());
}
async function finishJob() { await act(async () => { await vi.runAllTimersAsync(); }); }

describe("choice panel recovery", () => {
  it("runs lookahead only after a request, then invalidates it on a same-pick source refresh", async () => {
    vi.useFakeTimers(); const { snapshot, show } = setup(); const build = vi.spyOn(lookahead, "buildDraftLookahead"); show();
    expect(build).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Next pick market-order scenario"]')).toBeNull();
    const lean = host.querySelector("h3")?.textContent;
    click("Show next-pick scenario"); await finishJob(); expect(build).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Hypothetical market order, not an availability forecast");
    expect(host.querySelector('[data-testid="next-pick-scenario"]')).not.toBeNull();
    expect(host.querySelector("h3")?.textContent).toBe(lean);
    expect(host.querySelectorAll('[data-testid="two-pick-path"]')).toHaveLength(2);
    expect(host.textContent).toContain("no validated winner");
    const refreshed = structuredClone(snapshot); refreshed.projectionUpdatedAt = "2026-09-06T16:00:00Z";
    show(refreshed);
    expect(host.querySelector('[data-testid="next-pick-scenario"]')).toBeNull();
    expect(host.textContent).toContain("board changed");
    expect(build).toHaveBeenCalledTimes(2); // No automatic recomputation on refresh.
  });
  it("changes the hypothetical first choice, not the active default", async () => {
    vi.useFakeTimers(); const { show } = setup(); show();
    const cards = host.querySelectorAll('[data-testid="decision-recommendation-card"]');
    const first = cards[0]?.querySelector("h3")?.textContent;
    const alternative = [...cards[1]!.querySelectorAll("button")].find(node => node.textContent === "Preview after this pick")!;
    act(() => alternative.click()); await finishJob();
    expect(host.querySelector('[data-testid="decision-recommendation-card"] h3')?.textContent).toBe(first);
    expect(host.querySelector('[data-testid="next-pick-scenario"]')).not.toBeNull();
  });
  it("allows a local pick from every comparison card, but exposes no live pick action", () => {
    const { show } = setup(); show();
    expect([...host.querySelectorAll("button")].some(b => b.textContent?.startsWith("Pick "))).toBe(false);
    const onPick = vi.fn(); const board = show(undefined, onPick);
    const cards = host.querySelectorAll('[data-testid="decision-recommendation-card"]');
    for (const card of cards) {
      const button = [...card.querySelectorAll("button")].find(b => b.textContent?.startsWith("Pick "));
      expect(button).toBeDefined(); act(() => button!.click());
    }
    expect(onPick).toHaveBeenCalledTimes(cards.length);
    expect(onPick.mock.calls[0]?.[0].player_id).toBe(board.topRecommendation?.player.player_id);
  });
  it("keeps the current row if optional calculation throws", async () => {
    vi.useFakeTimers(); const { show } = setup(); show();
    vi.spyOn(lookahead, "buildDraftLookahead").mockImplementation(() => { throw new Error("Injected scenario failure"); });
    click("Show next-pick scenario"); await finishJob();
    expect(host.querySelector('[data-testid="decision-recommendation-card"]')).not.toBeNull();
    expect(host.textContent).toContain("Preview unavailable");
  });
  it("catches optional render errors without removing the current row", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.spyOn(console, "error").mockImplementation(() => {});
    host = document.createElement("div"); root = createRoot(host);
    function Broken(): React.ReactNode { throw new Error("Injected render failure"); }
    act(() => root!.render(<><div data-testid="current">Current row</div><DraftOptionalBoundary><Broken /></DraftOptionalBoundary></>));
    expect(host.querySelector('[data-testid="current"]')).not.toBeNull();
    expect(host.textContent).toContain("Preview unavailable");
  });
  it("shows pick errors even if a recent response timestamp exists", () => {
    const { snapshot } = setup(); const board = buildDraftValueBoard({ ...snapshot.boardInput, players: snapshot.boardInput.players.map((player) => ({ ...player, drafted: false, draftedByMe: false })) });
    act(() => root!.render(<DraftDataStaticProvider value={{ choiceSnapshot: snapshot, recommendationBoard: board,
      pickFeed: { checkedAt: Date.now(), paused: false, complete: false },
      error: { user: null, drafts: null, draftDetails: null, players: null, picks: new Error("offline") },
    }}><ChoiceComparison /></DraftDataStaticProvider>));
    expect(host.textContent).toContain("Pick update failed");
    expect(host.querySelector('[data-testid="decision-recommendation-card"]')).not.toBeNull();
  });
});
