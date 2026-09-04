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
    readiness: {
      status: "ready",
      cohorts: {
        core: {
          id: "core",
          label: "Core",
          ready: 120,
          total: 120,
          coveragePct: 100,
        },
        expected: {
          id: "expected",
          label: "Expected draft pool",
          ready: 176,
          total: 176,
          coveragePct: 100,
        },
        reserve: {
          id: "reserve",
          label: "Reserve pool",
          ready: 35,
          total: 36,
          coveragePct: 97.2,
        },
      },
      playerIssues: [
        {
          playerId: "reserve-1",
          name: "Reserve Player",
          cohorts: ["reserve"],
        },
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

  it("renders compact draft-readiness coverage", () => {
    act(() => {
      root.render(<DraftStatusCard />);
    });

    const health = container.querySelector('[data-testid="draft-data-ready"]');
    expect(health).not.toBeNull();
    const text = health?.textContent ?? "";

    expect(text).toContain("Data ready · Core 120/120 · Draft pool 176/176");
    expect(text).toContain("Reserve pool");
    expect(text).toContain("35/36 ready");
    expect(text).toContain("Reserve exceptions: Reserve Player");
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
