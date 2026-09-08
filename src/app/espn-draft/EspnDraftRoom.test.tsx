// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import EspnDraftRoom from "./EspnDraftRoom";
vi.mock("next/dynamic", () => ({ default: () => () => <div>Shared recommendations</div> }));
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterEach(() => vi.useRealTimers());
it("keeps source freshness separate from delivery and removes advice on stale or disconnected input", async () => {
  vi.useFakeTimers();
  const rootElement = document.createElement("div"); document.body.append(rootElement); const root = createRoot(rootElement);
  await act(async () => root.render(<EspnDraftRoom />));
  const now = Date.now();
  const room = { connected: true, updatedAt: now, error: null,
    data: { observedAt: now, leagueId: 9, season: 2026, name: "Practice", draftType: "SNAKE", practice: true, rankType: "PPR", scoringItems: [], teams: [], players: [] },
    live: { leagueId: 9, teamId: 2, state: 3, draftType: 1, limits: [], slots: [], teams: [], picks: [] } };
  const publish = async (connected: boolean, updatedAt: number, origin = location.origin) => act(async () => {
    window.dispatchEvent(new MessageEvent("message", { source: window, origin, data: { type: "espn-reader-update", draft: { room: { ...room, connected, updatedAt }, receivedAt: Date.now(), message: null } } }));
  });
  await publish(true, now, "https://evil.example");
  expect(rootElement.textContent).not.toContain("Shared recommendations");
  await publish(true, now);
  expect(rootElement.textContent).toContain("Shared recommendations");
  await act(async () => { location.hash = "players-wr"; vi.advanceTimersByTime(16000); });
  // Receiving an old snapshot again must not restore advice.
  await publish(true, now);
  expect(rootElement.textContent).toContain("Recommendations stopped");
  await publish(true, Date.now());
  expect(rootElement.textContent).toContain("Shared recommendations");
  await publish(false, Date.now());
  expect(rootElement.textContent).not.toContain("Shared recommendations");
  await act(async () => root.unmount()); rootElement.remove();
});
