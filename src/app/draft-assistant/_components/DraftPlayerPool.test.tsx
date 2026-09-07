/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { DraftDataStaticProvider } from "../_contexts/DraftDataContext";
import DraftWorkspace from "./DraftWorkspace";
import DraftPlayerPool from "./DraftPlayerPool";
import { draftChoiceFixture } from "@/lib/draftChoiceFixture";
import { buildDraftValueBoard } from "@/lib/draftValue";
import type { PlayerWithPick } from "@/lib/types.draft";

it("keeps position tables independent while filtering and collapsing the linked overall section", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); const client = new QueryClient();
  const snapshot = draftChoiceFixture(); snapshot.boardInput.currentPick = 4;
  const rb: PlayerWithPick = { player_id: "rb", name: "RB shard player", position: "RB", team: "TEST", fp_rank_ave: 2, draft_raw_value_score: 30, draft_value_score: 20, bye_week: 8 };
  const wr: PlayerWithPick = { player_id: "wr", name: "FLEX shard player", tier_level: 4, position_tier_level: 2, position: "WR", team: "TEST", bye_week: null, fp_rank_ave: 3, draft_raw_value_score: 40, draft_value_score: 10 };
  const defense: PlayerWithPick = { player_id: "def", name: "Manual defense", position: "DEF", team: "TEST", bye_week: 8, fp_rank_ave: 100 };
  const board = buildDraftValueBoard({ ...snapshot.boardInput, players: [...snapshot.boardInput.players, { ...snapshot.boardInput.players[0]!, player_id: "def", position: "DEF" as const }].map(p => ({ ...p, drafted: false, draftedByMe: false })), staticValuesByPlayerId: { ...snapshot.boardInput.staticValuesByPlayerId, def: 10 } });
  act(() => root.render(<QueryClientProvider client={client}><DraftDataStaticProvider value={{
    choiceSnapshot: snapshot, recommendationBoard: board, playersAll: [rb, wr, defense],
    playersByPosition: { ALL: [rb], RB: [rb], WR: [], FLEX: [wr], TE: [], QB: [], K: [], DEF: [defense] },
    userPositionRequirements: { RB: 2, WR: 2, FLEX: 2, DEF: 1 }, userPositionCounts: { RB: 1 },
    userRosterSlots: [{ slot: "RB", player: { player_id: "owned", name: "Owned RB", position: "RB", team: "TEST", bye_week: "8", rank: 1, tier: 1 } }, { slot: "RB", player: null }, { slot: "FLEX", player: null }, { slot: "FLEX", player: null }],
  }}><DraftPlayerPool loading={false} /></DraftDataStaticProvider></QueryClientProvider>));
  try {
    expect(host.textContent).not.toContain("Upcoming pick");
    expect(host.querySelector('[data-testid="decision-board"]')).toBeNull();
    const panel = (position: string) => host.querySelector(`#players-${position.toLowerCase()}`)!;
    const filters = host.querySelector('[aria-label="Overall position filters"]')!;
    const button = (label: string) => [...filters.querySelectorAll('button')].find(b => b.textContent === label)!;
    expect(panel("RB").textContent).toContain("RB shard player");
    expect(panel("FLEX").textContent).toContain("FLEX shard player");
    expect(panel("FLEX").textContent).toContain("Tier (FLEX)");
    expect(panel("FLEX").querySelectorAll("tbody td")[0]?.textContent).toBe("4");
    expect(panel("FLEX").textContent).not.toContain("RB shard player");
    expect(host.querySelector('a[href="#players-rb"]')).toBeNull();
    expect(host.querySelector('a[href="#players-overall"]')).toBeNull();
    expect(host.querySelector('#players-k')).toBeNull();
    act(() => button("RB").click());
    expect(panel("overall").textContent).not.toContain("RB shard player");
    expect(panel("RB").textContent).toContain("RB shard player");
    act(() => button("Reset").click());
    expect(panel("overall").textContent).toContain("RB shard player");
    act(() => button("FLEX").click());
    expect(panel("overall").textContent).toContain("RB shard player");
    expect(panel("overall").textContent).toContain("FLEX shard player");
    expect(panel("overall").textContent).not.toContain("Manual defense");
    expect(button("D/ST").getAttribute("aria-pressed")).toBe("false");
    act(() => button("FLEX").click());
    expect(panel("overall").textContent).toContain("RB shard player");
    const collapse = panel("overall").querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    act(() => collapse.click());
    expect(collapse.getAttribute("aria-expanded")).toBe("false");
    act(() => { window.location.hash = "players-overall"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    const val = [...panel("RB").querySelectorAll("th")].find(th => th.textContent === "VAL")!;
    act(() => val.querySelector("button")!.click());
    expect(val.getAttribute("aria-sort")).toBe("descending");
    act(() => panel("RB").querySelector<HTMLButtonElement>('[aria-label="Details for RB shard player"]')!.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Bye 8");
  } finally { act(() => root.unmount()); host.remove(); client.clear(); vi.unstubAllGlobals(); }
});

it("shows drafted players across tables from the sidebar and keeps pick actions disabled", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); const client = new QueryClient(); const onPick = vi.fn();
  const picked: PlayerWithPick = {player_id: "taken", name: "Taken RB", position: "RB", team: "TEST", bye_week: 8, fp_rank_ave: 1, draft_raw_value_score: 100, picked: {overall: 1}};
  const available: PlayerWithPick = {player_id: "free", name: "Available RB", position: "RB", team: "TEST", bye_week: 8, fp_rank_ave: 2, draft_raw_value_score: 40, draft_value_score: 80};
  const qb: PlayerWithPick = {...picked, player_id: "qb", name: "Taken QB", position: "QB", fp_rank_ave: null};
  try {
    act(() => root.render(<QueryClientProvider client={client}><DraftDataStaticProvider value={{playersAll:[picked,available,qb], playersByPosition:{ALL:[picked,available,qb],RB:[picked,available],WR:[],TE:[],QB:[qb],FLEX:[picked,available],K:[],DEF:[]}, userPositionRequirements:{RB:2,QB:1,FLEX:2},userPositionCounts:{QB:1}}}><DraftWorkspace><DraftPlayerPool loading={false} pickAction={{onPick}} /></DraftWorkspace></DraftDataStaticProvider></QueryClientProvider>));
    const pool = host.querySelector('[data-testid="draft-player-pool"]')!;
    expect(pool.textContent).not.toContain("Taken RB");
    expect(pool.textContent).not.toContain("Taken QB");
    const toggle = host.querySelector<HTMLButtonElement>('#show-drafted')!;
    act(() => toggle.click());
    for (const id of ["overall","rb","flex"]) {
      const section = host.querySelector(`#players-${id}`)!;
      expect(section.textContent).toContain("Taken RB");
      expect(section.querySelector("tbody tr")?.textContent).toContain("Taken RB");
      expect([...section.querySelectorAll("th")].find(th => th.textContent?.startsWith("VAL"))?.getAttribute("aria-sort")).toBe("descending");
      expect(section.querySelector('[data-row-drafted="true"]')?.textContent).toContain("Drafted");
      const button = section.querySelector<HTMLButtonElement>('[data-testid="mock-pick-taken"]');
      expect(button?.disabled).toBe(true);
      act(() => button!.click());
    }
    expect(host.querySelector('#players-qb')?.textContent).toContain("Taken QB");
    expect(onPick).not.toHaveBeenCalled();
    act(() => toggle.click());
    expect(pool.textContent).not.toContain("Taken RB");
    expect(pool.textContent).toContain("Available RB");
  } finally {act(() => root.unmount());host.remove();client.clear();vi.unstubAllGlobals();}
});
