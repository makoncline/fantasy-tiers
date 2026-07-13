/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DecisionBoard from "@/app/draft-assistant/_components/DecisionBoard";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { PlayerWithPick } from "@/lib/types.draft";

vi.mock("@/app/draft-assistant/_contexts/DraftDataContext", () => ({
  useDraftData: vi.fn(),
}));

const mockUseDraftData = vi.mocked(useDraftData);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function player(
  playerId: string,
  name: string,
  score: number,
  position: PlayerWithPick["position"] = "WR"
): PlayerWithPick {
  return {
    player_id: playerId,
    name,
    position,
    team: "TEST",
    bye_week: 8,
    fp_rank_pos: 1,
    draft_value_score: score,
    draft_recommendation_edge: "Slight edge",
    draft_recommendation_edge_detail: `${name} has a useful edge.`,
    draft_recommendation_pros: [`${name} pro`],
    draft_recommendation_cons: [`${name} con`],
    draft_data_quality_notes: [`${name} data`],
  };
}

describe("DecisionBoard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders a full card for every recommendation within five points", () => {
    const top = player("top", "Top Player", 100, "RB");
    const close = player("close", "Close Player", 97);
    const boundary = player("boundary", "Boundary Player", 95);
    const outside = player("outside", "Outside Player", 94.9);

    mockUseDraftData.mockReturnValue({
      decisionRows: [top, close, boundary, outside],
      topRecommendation: top,
      rosterConstruction: null,
      draftContext: null,
      userPositionCounts: {},
    } as never);

    act(() => root.render(<DecisionBoard />));

    const cards = container.querySelectorAll(
      '[data-testid="decision-recommendation-card"]'
    );
    expect(cards).toHaveLength(3);

    const closeOptions = container.querySelector(
      '[data-testid="decision-close-options"]'
    );
    const text = closeOptions?.textContent ?? "";
    expect(text).toContain("Close Player");
    expect(text).toContain("Close Player pro");
    expect(text).toContain("Close Player con");
    expect(text).toContain("Close Player data");
    expect(text).toContain("3 from top");
    expect(text).toContain("Boundary Player");
    expect(text).toContain("5 from top");
    expect(text).not.toContain("Outside Player");
  });

  it("shows every league starter position draining from its initial need", () => {
    const top = player("top", "Top Player", 100, "RB");
    mockUseDraftData.mockReturnValue({
      decisionRows: [top],
      topRecommendation: top,
      rosterConstruction: null,
      userPositionCounts: {},
      draftContext: {
        user: {
          starterSlotsRemaining: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1 },
          benchSlotsRemaining: 5,
          totalSlotsRemaining: 14,
        },
        room: {
          leagueStarterSlotsInitial: { QB: 10, RB: 20, WR: 20, TE: 10, FLEX: 10, K: 10, DEF: 10 },
          leagueStarterSlotsRemaining: { QB: 0, RB: 12, WR: 14, TE: 7, FLEX: 8, K: 10, DEF: 10 },
          leagueBenchDemandInitialByPosition: {},
          leagueBenchDemandByPosition: {},
        },
      },
    } as never);

    act(() => root.render(<DecisionBoard />));

    const text = container.textContent ?? "";
    expect(text).toContain("League starter needs");
    expect(text).toContain("QB0/10");
    expect(text).toContain("RB15.6/24.5");
    expect(text).toContain("WR17.6/24.5");
    expect(text).toContain("TE7.8/11");
    expect(text).toContain("K10/10");
    expect(text).toContain("DEF10/10");
  });
});
