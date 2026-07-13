import { describe, expect, it } from "vitest";
import { getSleeperSeasonCandidates } from "../../src/lib/sleeperSeasons";

describe("getSleeperSeasonCandidates", () => {
  it("uses Sleeper's active league season without falling back to previous season", () => {
    const result = getSleeperSeasonCandidates(
      {
        season: "2026",
        league_season: "2026",
        previous_season: "2025",
        league_create_season: "2026",
      },
      "2026"
    );

    expect(result).toEqual(["2026"]);
  });

  it("dedupes invalid or repeated season values", () => {
    const result = getSleeperSeasonCandidates(
      {
        season: "2026",
        league_season: "bad",
        previous_season: "2026",
      },
      "2026"
    );

    expect(result).toEqual(["2026"]);
  });
});
