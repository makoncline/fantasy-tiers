import { describe, expect, it } from "vitest";

import { parseSimBatchArgs } from "./cli";

describe("draft batch CLI", () => {
  it("parses shared league settings", () => {
    expect(
      parseSimBatchArgs(
        [
          "--runs",
          "3",
          "--slots",
          "all",
          "--reception",
          "0.5",
          "--slots-flex",
          "1",
        ],
        { seed: "test-seed" }
      )
    ).toMatchObject({
      runs: 3,
      slotsArg: "all",
      reception: 0.5,
      seed: "test-seed",
      rosterSlots: { FLEX: 1 },
    });
  });

  it("rejects the removed value-strategy flag", () => {
    expect(() =>
      parseSimBatchArgs(["--strategy", "beer_plus"], { seed: "test-seed" })
    ).toThrow("Unknown argument: --strategy");
  });
});
