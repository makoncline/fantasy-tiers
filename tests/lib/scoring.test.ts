// tests/lib/scoring.test.ts
import { describe, it, expect } from "vitest";
import {
  scoringKeys,
  scoringTypeFromReceptionPoints,
} from "../../src/lib/scoring";
import { ScoringType } from "../../src/lib/schemas";

describe("scoringKeys", () => {
  it("should return correct keys for std scoring", () => {
    const result = scoringKeys("std");
    expect(result).toEqual({
      sleeperSuffix: "std",
      fpKey: "standard",
      tierKey: "std",
    });
  });

  it("should return correct keys for ppr scoring", () => {
    const result = scoringKeys("ppr");
    expect(result).toEqual({
      sleeperSuffix: "ppr",
      fpKey: "ppr",
      tierKey: "ppr",
    });
  });

  it("should return correct keys for half scoring", () => {
    const result = scoringKeys("half");
    expect(result).toEqual({
      sleeperSuffix: "half_ppr",
      fpKey: "half",
      tierKey: "half",
    });
  });

  it("should have proper type constraints", () => {
    const result = scoringKeys("std");
    // TypeScript should enforce these are the exact types
    const sleeperSuffix: "ppr" | "half_ppr" | "std" = result.sleeperSuffix;
    const fpKey: "ppr" | "half" | "standard" = result.fpKey;
    const tierKey: ScoringType = result.tierKey;

    expect(sleeperSuffix).toBe("std");
    expect(fpKey).toBe("standard");
    expect(tierKey).toBe("std");
  });
});

describe("scoringTypeFromReceptionPoints", () => {
  it("maps exact common reception settings", () => {
    expect(scoringTypeFromReceptionPoints(0)).toBe("std");
    expect(scoringTypeFromReceptionPoints(0.5)).toBe("half");
    expect(scoringTypeFromReceptionPoints(1)).toBe("ppr");
  });

  it("maps custom reception scoring to the closest useful aggregate bucket", () => {
    expect(scoringTypeFromReceptionPoints(0.25)).toBe("half");
    expect(scoringTypeFromReceptionPoints(0.69)).toBe("ppr");
  });
});
