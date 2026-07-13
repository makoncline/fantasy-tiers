import { describe, expect, it } from "vitest";
import {
  expertSampleSize,
  fantasyProsExpertMetadata,
  normalizeExpertSampleMetadata,
} from "../../scripts/fp/fantasyprosExpertMetadata";

describe("FantasyPros expert metadata", () => {
  it("extracts expert counts, ids, and coverage from raw ECR payloads", () => {
    const metadata = fantasyProsExpertMetadata({
      filters: "1,2,3",
      total_experts: 3,
      experts_available: {
        total: 5,
        included: [1, 2, 3],
        excluded: [4, 5],
        last_update: 1782828882,
      },
    });

    expect(metadata).toEqual({
      included: 3,
      available: 5,
      coverage_pct: 60,
      included_ids: [1, 2, 3],
      excluded_ids: [4, 5],
      filter_ids: [1, 2, 3],
      last_updated: "2026-06-30T14:14:42.000Z",
      sample_size: "thin",
    });
  });

  it("normalizes stored expert metadata and recomputes the sample label", () => {
    expect(
      normalizeExpertSampleMetadata({
        included: 18,
        available: 40,
        included_ids: ["10", "11", "11"],
        excluded_ids: [12],
        filter_ids: "ignored",
      })
    ).toMatchObject({
      included: 18,
      available: 40,
      coverage_pct: 45,
      included_ids: [10, 11],
      excluded_ids: [12],
      filter_ids: [],
      sample_size: "limited",
    });
  });

  it("labels early-week expert sample sizes conservatively", () => {
    expect(expertSampleSize(null)).toBe("unknown");
    expect(expertSampleSize(4)).toBe("thin");
    expect(expertSampleSize(18)).toBe("limited");
    expect(expertSampleSize(56)).toBe("normal");
  });
});
