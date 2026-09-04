/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import DraftAssistantContent from "@/app/draft-assistant/_components/DraftAssistantContent";
import { DraftDataStaticProvider } from "@/app/draft-assistant/_contexts/DraftDataContext";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("DraftAssistantContent", () => {
  it("blocks the last board after a refresh error", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DraftDataStaticProvider
          value={{
            availablePlayers: [
              {
                player_id: "wr1",
                name: "Current Receiver",
                position: "WR",
                team: "DEN",
                bye_week: "12",
                rank: 1,
                tier: 1,
              },
            ],
            draftDetails: {
              draft_id: "draft-1",
              type: "snake",
              status: "paused",
              metadata: {},
              settings: {
                teams: 12,
                rounds: 14,
                slots_qb: 1,
                slots_rb: 2,
                slots_wr: 2,
                slots_te: 1,
                slots_k: 0,
                slots_def: 1,
                slots_flex: 2,
              },
              scoring_settings: {},
              slot_to_roster_id: {},
              draft_order: {},
            },
            error: {
              user: null,
              drafts: null,
              draftDetails: null,
              players: null,
              picks: new Error("temporary Sleeper error"),
            },
          }}
        >
          <DraftAssistantContent />
        </DraftDataStaticProvider>
      );
    });

    expect(container.textContent).toContain(
      "There was a problem loading draft data."
    );
    expect(container.textContent).not.toContain("Current Receiver");

    act(() => root.unmount());
    container.remove();
  });

  it("shows named failures and no draft board during a data incident", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DraftDataStaticProvider
          value={{
            readiness: {
              status: "incident",
              incidents: [
                {
                  code: "FETCH_STALE",
                  scope: "FantasyPros",
                  message: "FantasyPros was last fetched 20 hours ago.",
                },
              ],
              playerIssues: [
                {
                  playerId: "wr1",
                  name: "Priority Receiver",
                  position: "WR",
                  problems: ["Sleeper projection is missing."],
                },
              ],
            } as never,
          }}
        >
          <DraftAssistantContent />
        </DraftDataStaticProvider>
      );
    });

    expect(container.textContent).toContain("Draft data incident");
    expect(container.textContent).toContain("FantasyPros was last fetched");
    expect(container.textContent).toContain("Priority Receiver (WR)");
    expect(container.querySelector('[data-testid="decision-board"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it("shows the league rules that recommendations do not consider", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DraftDataStaticProvider
          value={{
            formatNotices: [
              {
                code: "SUPER_FLEX",
                message: "Superflex quarterback value is not considered.",
              },
              {
                code: "TE_PREMIUM",
                message: "Tight end premium scoring is not considered.",
              },
            ],
          }}
        >
          <DraftAssistantContent />
        </DraftDataStaticProvider>
      );
    });

    expect(container.textContent).toContain("Limited format support");
    expect(container.textContent).toContain(
      "Superflex quarterback value is not considered."
    );
    expect(container.textContent).toContain(
      "Tight end premium scoring is not considered."
    );
    expect(container.textContent).not.toContain("Draft value strategy");
    expect(container.textContent).not.toContain("Current ECR strategy");
    expect(container.textContent).not.toContain("Experimental");

    act(() => root.unmount());
    container.remove();
  });

  it("blocks recommendations when the draft value model is unavailable", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DraftDataStaticProvider
          value={{
            draftValueStatus: {
              available: false,
              reason:
                "Starter-aware value supports kickers only with standard Sleeper scoring because field-goal distance splits are not available.",
              source: "Sleeper season projections",
              sourceLastModified: "2026-09-03T00:00:00.000Z",
              playerCoveragePct: 100,
              requiredStatCoveragePct: 100,
              missingPositions: [],
              capabilityLimitations: [{
                code: "UNSUPPORTED_SCORING_RULE",
                scoringKey: "fieldGoalUnder50",
                position: "K",
                message:
                  "Starter-aware value supports kickers only with standard Sleeper scoring because field-goal distance splits are not available.",
              }],
            },
          }}
        >
          <DraftAssistantContent />
        </DraftDataStaticProvider>
      );
    });

    expect(container.textContent).toContain("Draft recommendations unavailable");
    expect(container.textContent).toContain(
      "supports kickers only with standard Sleeper scoring"
    );
    expect(container.textContent).not.toContain("Experimental");
    expect(container.querySelector('[data-testid="decision-board"]')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it("asks for a manual slot when Sleeper has not published the order", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <DraftDataStaticProvider
          value={{
            user: { user_id: "user-1", username: "makon" },
            draftDetails: {
              draft_id: "draft-1",
              type: "snake",
              status: "pre_draft",
              metadata: {},
              settings: {
                teams: 12,
                rounds: 14,
                slots_qb: 1,
                slots_rb: 2,
                slots_wr: 2,
                slots_te: 1,
                slots_k: 1,
                slots_def: 1,
                slots_flex: 1,
              },
              scoring_settings: {},
              slot_to_roster_id: {},
              draft_order: {},
            },
          }}
        >
          <DraftAssistantContent />
        </DraftDataStaticProvider>
      );
    });

    expect(container.textContent).toContain(
      "Sleeper has not set the draft order"
    );
    expect(container.textContent).toContain("Raw Val is available now.");
    expect(
      container.querySelector('[data-testid="manual-draft-slot-form"]')
    ).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
