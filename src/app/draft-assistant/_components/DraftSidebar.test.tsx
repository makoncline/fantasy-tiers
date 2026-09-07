/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DraftDataStaticProvider } from "../_contexts/DraftDataContext";
import DraftWorkspace from "./DraftWorkspace";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
const draftDetails = {
  draft_id: "123", type: "snake", status: "paused", metadata: {},
  settings: { teams: 12, rounds: 14, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1, slots_k: 0, slots_def: 1, slots_flex: 2 },
  scoring_settings: {}, slot_to_roster_id: {}, draft_order: {},
};
describe("DraftSidebar", () => {
  it("keeps the page and toggle available when collapsed, without calling vacancies urgent", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<DraftDataStaticProvider value={{ draftDetails, draftSlot: 4,
      userRosterSlots: [{ slot: "RB", player: null }, { slot: "FLEX", player: null }, { slot: "BN", player: null }] }}><DraftWorkspace><div>Player tables</div></DraftWorkspace></DraftDataStaticProvider>));
    expect(container.querySelectorAll('[aria-label="Toggle draft sidebar"]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Toggle draft sidebar"]')?.parentElement?.querySelector('h1')?.textContent).toBe("Draft Assistant");
    expect(container.querySelector('[data-testid="draft-sidebar"] [data-sidebar="trigger"]')).toBeNull();
    expect(document.body.textContent).toContain("Paused · 1.04");
    expect(document.body.textContent).toContain("Next 2.09 · 16 selections between");
    expect(document.body.textContent).toContain("RB 0/1FLEX 0/1");
    expect(document.body.textContent).not.toContain("Urgent:");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Toggle draft sidebar"]')?.click());
    expect(document.body.textContent).toContain("Paused · 1.04");
    expect(document.body.textContent).toContain("RB 0/1FLEX 0/1");
    expect(container.querySelector('[data-collapsible="offcanvas"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Toggle draft sidebar"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Player tables");
    act(() => root.unmount()); container.remove();
  });
  it("shows final-slot urgency and removes future turns when complete", () => {
    const container = document.createElement("div"); document.body.append(container);
    const root = createRoot(container);
    const render = (complete: boolean) => <DraftDataStaticProvider value={{
      draftDetails: { ...draftDetails, status: complete ? "complete" : "drafting", settings: { ...draftDetails.settings, rounds: 1 } },
      draftSlot: 4, userRosterSlots: [{ slot: "DEF", player: null }],
    }}><DraftWorkspace><div>Player tables</div></DraftWorkspace></DraftDataStaticProvider>;
    act(() => root.render(render(false)));
    expect(document.body.textContent).toContain("Urgent: use remaining picks for open starters.");
    expect(document.body.textContent).toContain("Next —");
    act(() => root.render(render(true)));
    expect(document.body.textContent).toContain("Finished");
    expect(document.body.textContent).not.toContain("Next 2.09");
    expect(document.body.textContent).not.toContain("Urgent:");
    act(() => root.unmount()); container.remove();
  });
});
