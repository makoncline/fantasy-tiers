import { describe, expect, it } from "vitest";
import {
  validateFantasyProsDraftRows,
  validateSleeperDraftRows,
} from "../../src/lib/sourceDataQuality";

describe("source draft-data quality", () => {
  it("rejects fenced FantasyPros ECR and missing rank averages", () => {
    expect(() =>
      validateFantasyProsDraftRows(
        Array.from({ length: 15 }, () => ({ rank_ave: 1 }))
      )
    ).toThrow(/too short/);
    expect(() =>
      validateFantasyProsDraftRows(
        Array.from({ length: 300 }, () => ({ rank_ave: null }))
      )
    ).toThrow(/missing rank_ave/);
  });

  it("accepts a healthy FantasyPros ECR response", () => {
    expect(() =>
      validateFantasyProsDraftRows(
        Array.from({ length: 300 }, (_, index) => ({ rank_ave: index + 1 }))
      )
    ).not.toThrow();
  });

  it("rejects the wrong Sleeper season and placeholder-only ADP", () => {
    const rows = Array.from({ length: 2_500 }, () => ({
      stats: { adp_std: 999, adp_half_ppr: 999, adp_ppr: 999 },
    }));
    expect(() => validateSleeperDraftRows(rows, "2025")).toThrow(/season 2026/);
    expect(() => validateSleeperDraftRows(rows, "2026")).toThrow(/too little real ADP/);
  });

  it("accepts a full Sleeper response with draft-relevant ADP", () => {
    const rows = Array.from({ length: 2_500 }, (_, index) => ({
      stats: {
        adp_std: index < 150 ? index + 1 : 999,
        adp_half_ppr: 999,
        adp_ppr: 999,
      },
    }));
    expect(() => validateSleeperDraftRows(rows, "2026")).not.toThrow();
  });
});
