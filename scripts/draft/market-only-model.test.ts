import { describe, expect, it } from "vitest";
import { marketForecast, MarketForecastInputSchema, summarizeMarketGroup } from "./market-only-model";
import { verifyProspectiveBoundary } from "./prospective-integrity";
import { DraftPicksSchema } from "../../src/lib/schemas";

const players = Array.from({ length: 36 }, (_, i) => ({
  id: String(i), name: `Player ${i}`, position: i % 3 === 0 ? "DEF" as const : i % 3 === 1 ? "QB" as const : "TE" as const, rank: i + 1,
}));
const input = { players, pickedIds: ["1", "2"], teams: 4, rounds: 6, ownerSlot: 2, nextOwnPick: 7, samples: 128, seed: "separation" };

describe("market-only prospective forecasts", () => {
  it("keeps backups, early defenses and missing-ECR players independent of owner policy", () => {
    const base = marketForecast(input);
    const ownerVariant = MarketForecastInputSchema.parse({ ...input,
      ownerPolicy: { maxQB: 1, maxTE: 1, lateDefense: true, requireEcr: true, wr2Round: 5 },
      players: players.map((p) => ({ ...p, ecr: null, projectedPoints: -1000, eligibleForOwner: false })),
      rosters: { 1: ["QB", "TE"], 2: ["QB", "TE"] },
    });
    expect(marketForecast(ownerVariant)).toEqual(base);
    expect(base.sequences.some((s) => s.includes("0"))).toBe(true);
    expect(base.sequences.some((s) => s.includes("4"))).toBe(true);
    expect(base.sequences.some((s) => s.includes("5"))).toBe(true);
    for (const sequence of base.sequences) {
      expect(new Set(sequence).size).toBe(4);
      expect(sequence).not.toContain("1");
      expect(sequence).not.toContain("2");
    }
    const group = summarizeMarketGroup(base, ["0", "4", "5"]);
    expect(group?.expectedRemaining).toBeGreaterThanOrEqual(0);
    expect(group?.expectedRemaining).toBeLessThanOrEqual(3);
  });

  it("uses the exact next turn, including zero intervening picks, and rejects a skipped own turn", () => {
    const adjacent = marketForecast({ ...input, pickedIds: ["1", "2", "3", "4"], ownerSlot: 4, nextOwnPick: 5 });
    expect(adjacent.distance).toBe(0);
    expect(Object.values(adjacent.survival).every((p) => p === 1)).toBe(true);
    expect(() => marketForecast({ ...input, nextOwnPick: 10 })).toThrow("immediate next own pick");
  });

  it("accepts a non-default owner pick but rejects a changed observed prefix", () => {
    const picks = DraftPicksSchema.parse([{
      pick_no: 1, round: 1, draft_slot: 1, player_id: "0", picked_by: "owner", roster_id: 1,
      metadata: { first_name: "Player", last_name: "Zero", position: "DEF", team: "TEST" },
      draft_id: "test", is_keeper: false,
    }]);
    const capture = { picks: [], conditionedSelectionId: "0", nextOwnPick: 8, defaultId: "7", capturedAt: "2026-09-05T20:00:00.000Z", confirmedAt: "2026-09-05T20:00:01.000Z" };
    expect(verifyProspectiveBoundary(capture, picks)).toEqual({ evidenceValid: true, ownerFollowedDefault: false });
    expect(() => verifyProspectiveBoundary(capture, [{ ...picks[0]!, player_id: "7" }])).toThrow("prefix");
  });
});
