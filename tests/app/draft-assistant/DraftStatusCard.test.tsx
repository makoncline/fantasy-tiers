/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DraftStatusCard from "@/app/draft-assistant/_components/DraftStatusCard";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";

vi.mock("@/app/draft-assistant/_contexts/DraftDataContext", () => ({
  useDraftData: vi.fn(),
}));

const mockUseDraftData = vi.mocked(useDraftData);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function draftDataContext() {
  return {
    user: {
      user_id: "u1",
      username: "test-user",
      display_name: "Test User",
    },
    draftDetails: {
      status: "drafting",
      settings: { teams: 10, rounds: 15 },
      draft_order: { u1: 5 },
    },
    picks: [],
    userPositionCounts: {},
    userPositionNeeds: {},
    userPositionRequirements: {},
    getRosterStatus: (pos: string) => ({
      count: pos === "RB" ? 1 : 0,
      requirement: pos === "FLEX" ? 1 : 2,
      met: false,
    }),
    refetchData: vi.fn(),
    loading: {
      draftDetails: false,
      picks: false,
      players: false,
    },
    lastUpdatedAt: Date.now(),
    league: { teams: 10 },
    showAll: false,
    setShowAll: vi.fn(),
    showDrafted: false,
    setShowDrafted: vi.fn(),
    showUnranked: false,
    setShowUnranked: vi.fn(),
    positionRows: { ALL: [] },
    sourceHealth: {
      generatedAt: "2026-06-30T12:40:00.000Z",
      scoring: "half",
      sources: [
        {
          source: "Sleeper",
          status: "ok",
          lastUpdated: "2026-06-30T12:34:00.000Z",
          fetchedAt: null,
          rowCount: 600,
          coveragePct: 92,
          sampleSize: null,
          projectionsFetched: true,
          warnings: [],
        },
        {
          source: "FantasyPros",
          status: "warning",
          lastUpdated: "2026-06-30T11:00:00.000Z",
          fetchedAt: "2026-06-30T12:00:00.000Z",
          rowCount: 360,
          coveragePct: 42,
          sampleSize: "limited",
          projectionsFetched: false,
          warnings: ["FantasyPros expert coverage is below 50%."],
        },
        {
          source: "Tiers",
          status: "ok",
          lastUpdated: "2026-06-30T11:30:00.000Z",
          fetchedAt: "2026-06-30T12:05:00.000Z",
          rowCount: 360,
          coveragePct: 88,
          sampleSize: "normal",
          projectionsFetched: null,
          warnings: [],
        },
      ],
      warnings: [
        "FantasyPros: FantasyPros expert coverage is below 50%.",
      ],
    },
  };
}

describe("DraftStatusCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDraftData.mockReturnValue(draftDataContext() as never);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders source freshness, coverage, and warnings", () => {
    act(() => {
      root.render(<DraftStatusCard />);
    });

    const health = container.querySelector('[data-testid="draft-source-health"]');
    expect(health).not.toBeNull();
    const text = health?.textContent ?? "";

    expect(text).toContain("Sleeper");
    expect(text).toContain("updated 2026-06-30 12:34");
    expect(text).toContain("600 rows");
    expect(text).toContain("92% coverage");
    expect(text).not.toContain("proj yes");

    expect(text).toContain("FantasyPros");
    expect(text).toContain("360 rows");
    expect(text).toContain("42% coverage");
    expect(text).toContain("limited sample");
    expect(text).not.toContain("proj no");
    expect(text).toContain(
      "FantasyPros: FantasyPros expert coverage is below 50%."
    );
  });

  it("counts picks to the user's slot across a snake turn", () => {
    mockUseDraftData.mockReturnValue({
      ...draftDataContext(),
      picks: Array.from({ length: 10 }, (_, index) => ({
        player_id: `p${index + 1}`,
        pick_no: index + 1,
        round: 1,
        draft_slot: index + 1,
      })),
    } as never);

    act(() => {
      root.render(<DraftStatusCard />);
    });

    expect(container.textContent).toContain("5 picks away · 2.01");
  });

  it("renders a terminal summary instead of another turn when complete", () => {
    mockUseDraftData.mockReturnValue({
      ...draftDataContext(),
      draftDetails: {
        ...draftDataContext().draftDetails,
        status: "complete",
      },
      picks: Array.from({ length: 150 }, (_, index) => ({
        player_id: `p${index + 1}`,
        pick_no: index + 1,
        round: Math.ceil((index + 1) / 10),
        draft_slot: (index % 10) + 1,
      })),
    } as never);

    act(() => {
      root.render(<DraftStatusCard />);
    });

    expect(container.textContent).toContain("Draft Complete");
    expect(container.textContent).toContain("150/150 picks");
    expect(container.textContent).not.toContain("picks away");
    expect(container.textContent).not.toContain("On the clock");
  });
});
