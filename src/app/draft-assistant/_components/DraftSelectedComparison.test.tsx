/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DraftDataStaticProvider } from "../_contexts/DraftDataContext";
import { ComparePlayerButton, DraftComparisonProvider, DraftSelectedComparison } from "./DraftSelectedComparison";
import type { PlayerWithPick } from "@/lib/types.draft";

it("keeps chosen pairs across live updates and stops comparing scores after a pick", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const a: PlayerWithPick = { player_id: "a", name: "Alpha", position: "RB", team: null, bye_week: 11, draft_raw_value_score: 30, draft_value_score: 40 };
  const b: PlayerWithPick = { ...a, player_id: "b", name: "Beta", draft_raw_value_score: 20, draft_value_score: 45 };
  const render = (rows: PlayerWithPick[]) => act(() => root.render(<DraftDataStaticProvider value={{ playersAll: rows }}><DraftComparisonProvider><ComparePlayerButton player={a} /><ComparePlayerButton player={b} /><DraftSelectedComparison /></DraftComparisonProvider></DraftDataStaticProvider>));
  try {
    render([a, b]);
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Compare Alpha"]')!.click());
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Compare Beta"]')!.click());
    expect(host.textContent).toContain("-10.0 Val / +5.0 Adj");
    render([a, { ...b, draft_value_score: 42 }]);
    expect(host.textContent).toContain("-10.0 Val / +2.0 Adj");
    render([{ ...a, picked: { overall: 1 } }, b]);
    expect(host.textContent).toContain("Drafted — no longer available");
    expect(host.textContent).toContain("Your comparison (2/3)");
    expect(host.textContent).not.toContain("-10.0 Val");
  } finally { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
