/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AvailablePlayers from "@/app/draft-assistant/_components/availablePlayers";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { PlayerWithPick } from "@/lib/types.draft";

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

function player(
  player_id: string,
  position: PlayerWithPick["position"],
  score: number
): PlayerWithPick {
  return {
    player_id,
    name: player_id,
    position,
    team: "DEN",
    bye_week: 10,
    fp_rank_ave: score,
    draft_raw_value_score: score,
    draft_value_score: score,
  };
}

describe("AvailablePlayers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const rows = Array.from({ length: 55 }, (_, index) =>
      player(`RB ${index + 1}`, "RB", index + 1)
    );
    rows.push(player("Filled QB", "QB", 100));
    rows.push(player("No Kicker", "K", 99));
    rows.push({ ...player("Drafted", "WR", 98), picked: true });
    rows.push({ ...player("Missing ECR", "WR", 97), fp_rank_ave: null });

    mockUseDraftData.mockReturnValue({
      playersAll: rows,
      userRosterSlots: [],
      userPositionCounts: { QB: 1 },
      userPositionRequirements: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        FLEX: 2,
        K: 0,
        DEF: 1,
        BN: 5,
      },
      showDiagnostics: false,
      setShowDiagnostics: vi.fn(),
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

  it("shows 50 ECR-qualified and roster-legal players by Adj", () => {
    act(() => root.render(<AvailablePlayers loading={false} />));

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(50);
    expect(rows[0]?.textContent).toContain("RB 55");
    expect(container.textContent).not.toContain("Filled QB");
    expect(container.textContent).not.toContain("No Kicker");
    expect(container.textContent).not.toContain("Drafted");
    expect(container.textContent).not.toContain("Missing ECR");
    expect(container.textContent).not.toContain("ALL");
    expect(container.textContent).not.toContain("FLEX");
    expect(container.textContent).not.toContain("SPECIAL");
  });

  it("keeps drafted and missing-ECR players in the diagnostic view", () => {
    const current = mockUseDraftData();
    mockUseDraftData.mockReturnValue({
      ...current,
      showDiagnostics: true,
    } as never);

    act(() => root.render(<AvailablePlayers loading={false} />));

    expect(container.textContent).toContain("Drafted");
    expect(container.textContent).toContain("Missing ECR");
    expect(container.textContent).not.toContain("RB 55");
  });
});
