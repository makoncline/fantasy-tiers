import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchSleeperDraftMarket,
  getSleeperBoardValue,
} from "@/lib/sleeperDraftMarket";

describe("Sleeper draft market", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads scoring-specific board values, active depth, and injuries", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/values/regular/2026/")) {
        const value = url.includes("/ppr?")
          ? 30
          : url.includes("/half_ppr?")
            ? 20
            : 10;
        return Response.json({ player1: value });
      }
      if (url === "https://sleeper.app/graphql") {
        return Response.json({
          data: {
            get_active_players: [
              {
                player_id: "player1",
                position: "RB",
                team: "DEN",
                depth_chart_position: "RB",
                depth_chart_order: 1,
              },
            ],
          },
        });
      }
      return Response.json({
        player1: {
          injury_body_part: "Ankle",
          injury_status: "Questionable",
        },
      });
    });

    const artifact = await fetchSleeperDraftMarket(
      "2026",
      new Date("2026-09-03T12:00:00.000Z")
    );

    expect(getSleeperBoardValue(artifact, "std", "player1")).toBe(10);
    expect(getSleeperBoardValue(artifact, "half", "player1")).toBe(20);
    expect(getSleeperBoardValue(artifact, "ppr", "player1")).toBe(30);
    expect(artifact.activePlayers.player1).toMatchObject({
      depth_chart_position: "RB",
      depth_chart_order: 1,
    });
    expect(artifact.injuries.player1).toMatchObject({
      injury_body_part: "Ankle",
      injury_status: "Questionable",
    });
  });
});
