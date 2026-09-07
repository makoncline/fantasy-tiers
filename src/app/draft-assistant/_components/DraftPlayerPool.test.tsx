/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { DraftDataStaticProvider } from "../_contexts/DraftDataContext";
import DraftPlayerPool from "./DraftPlayerPool";
import { draftChoiceFixture } from "@/lib/draftChoiceFixture";
import { buildDraftValueBoard } from "@/lib/draftValue";
import type { PlayerWithPick } from "@/lib/types.draft";

it("keeps shared facts, shard-specific pools, and per-tab sorting without recommendations", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host); const client = new QueryClient();
  const snapshot = draftChoiceFixture(); snapshot.boardInput.currentPick = 4;
  const rb: PlayerWithPick = { player_id: "rb", name: "RB shard player", position: "RB", team: "TEST", fp_rank_ave: 2, draft_raw_value_score: 30, draft_value_score: 20, bye_week: 8 };
  const wr: PlayerWithPick = { player_id: "wr", name: "FLEX shard player", position: "WR", team: "TEST", bye_week: null, fp_rank_ave: 3, draft_raw_value_score: 40, draft_value_score: 10 };
  const defense: PlayerWithPick = { player_id: "def", name: "Manual defense", position: "DEF", team: "TEST", bye_week: 8, fp_rank_ave: 100 };
  const board = buildDraftValueBoard({ ...snapshot.boardInput, players: [...snapshot.boardInput.players, { ...snapshot.boardInput.players[0]!, player_id: "def", position: "DEF" as const }].map(p => ({ ...p, drafted: false, draftedByMe: false })), staticValuesByPlayerId: { ...snapshot.boardInput.staticValuesByPlayerId, def: 10 } });
  act(() => root.render(<QueryClientProvider client={client}><DraftDataStaticProvider value={{
    choiceSnapshot: snapshot, recommendationBoard: board, playersAll: [rb],
    playersByPosition: { ALL: [rb], RB: [rb], WR: [], FLEX: [wr], TE: [], QB: [], K: [], DEF: [defense] },
    userPositionRequirements: { RB: 2, WR: 2, FLEX: 2, DEF: 1 }, userPositionCounts: { RB: 1 },
    userRosterSlots: [{ slot: "RB", player: { player_id: "owned", name: "Owned RB", position: "RB", team: "TEST", bye_week: "8", rank: 1, tier: 1 } }, { slot: "RB", player: null }, { slot: "FLEX", player: null }, { slot: "FLEX", player: null }],
  }}><DraftPlayerPool loading={false} /></DraftDataStaticProvider></QueryClientProvider>));
  try {
    expect(host.textContent).toContain("16 opponent selections until 2.09 (#21)");
    expect(host.querySelector('[data-testid="decision-board"]')).toBeNull();
    const panel = (value: string) => [...host.querySelectorAll('[role="tabpanel"]')].find(p => p.id.endsWith(`content-${value}`))!;
    const tab = (label: string) => [...host.querySelectorAll('[role="tab"]')].find(t => t.textContent === label)!;
    act(() => tab("RB").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })));
    expect(panel("RB").textContent).toContain("RB shard player");
    expect(panel("RB").textContent).not.toContain("Eligible for RB2");
    expect(panel("RB").querySelector('[title="Shares bye 8 with Owned RB"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Your comparison"]')).toBeNull();
    const val = [...panel("RB").querySelectorAll("th")].find(th => th.textContent === "VAL")!;
    act(() => val.click());
    expect(panel("RB").textContent).toContain("Sorted by VAL");
    act(() => tab("FLEX").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })));
    expect(panel("FLEX").textContent).toContain("FLEX shard player");
    expect(panel("FLEX").textContent).not.toContain("RB shard player");
    expect(panel("FLEX").textContent).not.toContain("League needs: 0");
    act(() => tab("D/ST").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })));
    expect(panel("DEF").textContent).toContain("Manual only: specialist deferred by roster policy");
    act(() => tab("RB").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })));
    expect(panel("RB").textContent).toContain("Sorted by VAL");
  } finally { act(() => root.unmount()); host.remove(); client.clear(); vi.unstubAllGlobals(); }
});
