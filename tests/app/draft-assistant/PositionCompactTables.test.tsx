/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PositionCompactTables from "@/app/draft-assistant/_components/PositionCompactTables";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";

vi.mock("@/app/draft-assistant/_contexts/DraftDataContext", () => ({
  useDraftData: vi.fn(),
}));

vi.mock("@/app/draft-assistant/_components/PreviewPickDialog", () => ({
  default: () => null,
}));

const mockUseDraftData = vi.mocked(useDraftData);

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("PositionCompactTables", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const currentEcrRow = {
      player_id: "current-ecr",
      name: "Current ECR",
      position: "QB",
      team: "DEN",
      bye_week: 12,
      fp_rank_ave: 14,
      position_tier_level: 2,
      tier_rank: null,
      draft_value_score: 81,
      sleeper_adp: 18,
      sleeper_adp_round_pick: "2.08",
    };
    mockUseDraftData.mockReturnValue({
      playersByPosition: {
        QB: [
          currentEcrRow,
          {
            ...currentEcrRow,
            player_id: "obsolete-only",
            name: "Obsolete Tier Row",
            fp_rank_ave: null,
            position_tier_level: null,
            tier_rank: 1,
          },
        ],
        RB: [],
        WR: [],
        FLEX: [],
        TE: [],
        DEF: [],
        K: [],
      },
      userRosterSlots: [],
      getRosterStatus: () => ({ count: 0, requirement: 1, met: false }),
      showAll: false,
      setShowAll: vi.fn(),
      showDrafted: false,
      setShowDrafted: vi.fn(),
      showUnranked: false,
      setShowUnranked: vi.fn(),
    } as never);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("shows current FP rows in compact position columns without projection UI", () => {
    act(() => root.render(<PositionCompactTables />));

    const qbCard = container.querySelector('[data-testid="pos-card-QB"]');
    expect(qbCard?.textContent).toContain("Current ECR");
    expect(qbCard?.textContent).not.toContain("Obsolete Tier Row");

    const headers = Array.from(qbCard?.querySelectorAll("thead tr:last-child th") ?? []).map(
      (header) => header.textContent
    );
    expect(headers).toEqual(["Name", "Tier", "VAL ▼", "ADP", "Preview"]);
    expect(qbCard?.textContent).not.toContain("baseline");
    expect(qbCard?.textContent).not.toContain("pts");
    expect(container.querySelector('[data-testid="data-last-updated"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Preview Current ECR"]')).not.toBeNull();
  });
});
