import { describe, expect, it } from "vitest";

import { classifyDraftAvailability } from "@/lib/draftAvailability";

describe("classifyDraftAvailability", () => {
  it.each([
    [null, null, "healthy", true],
    ["Questionable", null, "short-term-concern", true],
    ["PUP", "Recovering from surgery", "material-risk", true],
    ["IR", "Out for the season", "unavailable", false],
    ["NA", null, "unknown", true],
  ] as const)(
    "classifies %s status as %s",
    (injuryStatus, injuryNotes, classification, eligible) => {
      expect(
        classifyDraftAvailability({
          injuryStatus,
          injuryNotes,
          currentRound: 3,
          rounds: 14,
          irSlots: 1,
        })
      ).toMatchObject({ classification, eligible });
    }
  );

  it("marks rankings stale only when newer news accompanies a real concern", () => {
    const concern = classifyDraftAvailability({
      injuryStatus: "Questionable",
      newsUpdated: Date.parse("2026-09-04T01:00:00Z"),
      rankingsUpdatedAt: Date.parse("2026-09-03T21:00:00Z"),
      currentRound: 2,
      rounds: 14,
      irSlots: 1,
    });
    const healthy = classifyDraftAvailability({
      newsUpdated: Date.parse("2026-09-04T01:00:00Z"),
      rankingsUpdatedAt: Date.parse("2026-09-03T21:00:00Z"),
      currentRound: 2,
      rounds: 14,
      irSlots: 1,
    });

    expect(concern.rankingsMayBeStale).toBe(true);
    expect(concern.penalty).toBe(2);
    expect(healthy.rankingsMayBeStale).toBe(false);
  });
});
