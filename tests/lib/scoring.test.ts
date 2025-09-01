// tests/lib/scoring.test.ts
import { describe, it, expect } from "vitest";
import { scoringKeys } from "../../src/lib/scoring";
import { ScoringType } from "../../src/lib/schemas";

describe("scoringKeys", () => {
  it("should return correct keys for std scoring", () => {
    const result = scoringKeys("std");
    expect(result).toEqual({
      sleeperSuffix: "std",
      fpKey: "standard",
      borisKey: "std",
    });
  });

  it("should return correct keys for ppr scoring", () => {
    const result = scoringKeys("ppr");
    expect(result).toEqual({
      sleeperSuffix: "ppr",
      fpKey: "ppr",
      borisKey: "ppr",
    });
  });

  it("should return correct keys for half scoring", () => {
    const result = scoringKeys("half");
    expect(result).toEqual({
      sleeperSuffix: "half_ppr",
      fpKey: "half",
      borisKey: "half",
    });
  });

  it("should have proper type constraints", () => {
    const result = scoringKeys("std");
    // TypeScript should enforce these are the exact types
    const sleeperSuffix: "ppr" | "half_ppr" | "std" = result.sleeperSuffix;
    const fpKey: "ppr" | "half" | "standard" = result.fpKey;
    const borisKey: ScoringType = result.borisKey;

    expect(sleeperSuffix).toBe("std");
    expect(fpKey).toBe("standard");
    expect(borisKey).toBe("std");
  });
});
