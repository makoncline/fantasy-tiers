/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChoiceComparison from "@/app/draft-assistant/_components/ChoiceComparison";
import { DraftDataStaticProvider } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { draftChoiceFixture } from "./draftChoiceFixture";
import { buildDraftValueBoard } from "./draftValue";
import * as lookahead from "./draftLookahead";
let root: Root | null = null;
let host: HTMLDivElement;
let client: QueryClient;
afterEach(() => { if (root) act(() => root?.unmount()); root = null; client?.clear(); host?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const snapshot = draftChoiceFixture();
  const show = (next = snapshot, onPick?: (player: { player_id: string }) => void) => {
    const board = buildDraftValueBoard({ ...next.boardInput, players: next.boardInput.players.map(player => ({ ...player, drafted: false, draftedByMe: false })) });
    act(() => root!.render(<QueryClientProvider client={client}><DraftDataStaticProvider value={{ choiceSnapshot: next, recommendationBoard: board }}><ChoiceComparison pickAction={onPick ? { onPick } : undefined} /></DraftDataStaticProvider></QueryClientProvider>));
    return board;
  };
  return { snapshot, show };
}
async function finish() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); }); }
describe("next-turn table", () => {
  it("automatically shows a conditional future table without changing the default", async () => {
    const { show } = setup(); const build = vi.spyOn(lookahead, "buildDraftLookahead"); const board = show();
    const saved = JSON.stringify(board);
    expect(host.querySelector('[data-testid="decision-recommendation-row"]')?.textContent).toContain(board.topRecommendation?.player.name);
    expect([...host.querySelectorAll("button")].some(b => b.textContent === "Next pick")).toBe(false);
    await finish();
    expect(build).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[aria-label="Next-turn player comparison"]')).not.toBeNull();
    expect(host.textContent).toContain("does not estimate survival odds");
    expect(JSON.stringify(board)).toBe(saved);
  });
  it("updates after new source inputs instead of displaying old scenario rows", async () => {
    const { show, snapshot } = setup(); const build = vi.spyOn(lookahead, "buildDraftLookahead"); show(); await finish();
    const next = structuredClone(snapshot); next.projectionUpdatedAt = "2026-09-07T12:00:00Z";
    show(next);
    expect(host.querySelector('[aria-label="Next-turn player comparison"]')).toBeNull();
    await finish(); expect(build).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[aria-label="Next-turn player comparison"]')).not.toBeNull();
  });
  it("keeps current recommendations if the preview fails, and skips it on a final pick", async () => {
    const { show, snapshot } = setup(); const build = vi.spyOn(lookahead, "buildDraftLookahead").mockImplementation(() => { throw new Error("Injected failure"); });
    show(); await finish();
    expect(host.textContent).toContain("Next-turn preview unavailable");
    expect(host.querySelector('[data-testid="decision-recommendation-row"]')).not.toBeNull();
    const final = structuredClone(snapshot); final.boardInput.rounds = 1;
    show(final); await finish();
    expect(host.querySelector('[data-testid="next-pick-table"]')).toBeNull();
    expect(build).toHaveBeenCalledTimes(1);
  });
  it("retains local pick actions only on the current recommendations", async () => {
    const { show } = setup(); const pick = vi.fn(); show(undefined, pick); await finish();
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('[data-testid="recommendation-reason"] button')];
    expect(buttons.length).toBeGreaterThan(0);
    act(() => buttons[0]!.click()); expect(pick).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="next-pick-table"] button[aria-label^="Pick "]')).toBeNull();
  });
});

it("removes Lead emphasis during a failed feed and recovers after another team takes the target", () => {
  const { snapshot } = setup();
  snapshot.boardInput.rounds = 1;
  const first = buildDraftValueBoard(snapshot.boardInput);
  const target = first.topRecommendation!.player;
  const retry = vi.fn();
  const render = (failed: boolean, taken: boolean) => {
    const board = taken ? buildDraftValueBoard({...snapshot.boardInput, players: snapshot.boardInput.players.map(p => p.player_id === target.player_id ? {...p,drafted:true,draftedByMe:false} : p)}) : first;
    act(() => root!.render(<QueryClientProvider client={client}><DraftDataStaticProvider value={{choiceSnapshot:snapshot,recommendationBoard:board,pickFeed:{checkedAt:failed ? Date.now()-30_000 : Date.now(),complete:false,paused:false},error:{user:null,drafts:null,draftDetails:null,players:null,picks:failed ? new Error("Offline") : null},refetchData:retry}}><ChoiceComparison /></DraftDataStaticProvider></QueryClientProvider>));
  };
  render(false,false);
  expect(host.textContent).toContain("Lead");
  render(true,false);
  expect(host.textContent).toContain("Waiting for current picks.");
  expect(host.textContent).not.toContain("Lead");
  expect(host.querySelector('[aria-label="Recommended player comparison"]')).not.toBeNull();
  act(() => [...host.querySelectorAll('button')].find(b=>b.textContent==='Retry updates')!.click());
  expect(retry).toHaveBeenCalledOnce();
  render(false,true);
  expect(host.textContent).not.toContain("Waiting for current picks.");
  expect(host.textContent).toContain("Lead");
  expect([...host.querySelectorAll('[data-testid="decision-recommendation-row"]')].some(row=>row.textContent?.includes(target.name))).toBe(false);
});
