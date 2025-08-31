import { describe, it, expect } from "vitest";
import {
  calculateTeamNeedsAndCountsForSingleTeam,
  ZERO_ROSTER_SLOT_COUNTS,
  FLEX_POSITIONS,
} from "./draftHelpers";
import type { Position, RosterSlot } from "./schemas";

describe("calculateTeamNeedsAndCountsForSingleTeam (FLEX allocation)", () => {
  it("allocates extra WR to FLEX when WR primary needs are filled", () => {
    const rosterRequirements: Record<RosterSlot, number> = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DEF: 1,
      BN: 0,
    };

    // Drafted: 1 QB, 1 TE, 3 WR (one should go to FLEX), 1 RB
    const drafted: { position: Position }[] = [
      { position: "QB" },
      { position: "TE" },
      { position: "WR" },
      { position: "WR" },
      { position: "WR" },
      { position: "RB" },
    ];

    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(drafted, rosterRequirements);

    // Two WR should fill WR, the third should be counted towards FLEX and WR
    expect(positionCounts.WR).toBe(3);
    expect(positionCounts.FLEX).toBe(1);

    // Needs: WR should be 0, FLEX should be 0 (was 1, now satisfied by the extra WR)
    expect(positionNeeds.WR).toBe(0);
    expect(positionNeeds.FLEX).toBe(0);

    // Other needs remain (e.g., RB still needs 1 more to reach 2)
    expect(positionNeeds.RB).toBe(1);
    // K and DEF unchanged
    expect(positionNeeds.K).toBe(1);
    expect(positionNeeds.DEF).toBe(1);
  });

  it("allocates extra WR to FLEX when WR primary needs are filled (second test)", () => {
    const rosterRequirements: Record<RosterSlot, number> = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DEF: 1,
      BN: 0,
    };

    // Drafted: 1 QB, 1 TE, 3 WR (one should go to FLEX), 1 RB
    const drafted: { position: Position }[] = [
      { position: "QB" },
      { position: "TE" },
      { position: "WR" },
      { position: "WR" },
      { position: "WR" },
      { position: "RB" },
    ];

    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(drafted, rosterRequirements);

    // All WR should be counted at WR position, the third should also be counted towards FLEX
    expect(positionCounts.WR).toBe(3);
    expect(positionCounts.FLEX).toBe(1);

    // Needs: WR should be 0, FLEX should be 0 (was 1, now satisfied by the extra WR)
    expect(positionNeeds.WR).toBe(0);
    expect(positionNeeds.FLEX).toBe(0);

    // Other needs remain (e.g., RB still needs 1 more to reach 2)
    expect(positionNeeds.RB).toBe(1);
    // K and DEF unchanged
    expect(positionNeeds.K).toBe(1);
    expect(positionNeeds.DEF).toBe(1);
  });

  it("only allocates to FLEX for FLEX-eligible positions (RB/WR/TE)", () => {
    const rosterRequirements: Record<RosterSlot, number> = {
      QB: 1,
      RB: 1,
      WR: 1,
      TE: 1,
      FLEX: 1,
      K: 0,
      DEF: 0,
      BN: 0,
    };

    // Draft two QBs (only one can fill QB), and draft an extra WR to fill FLEX
    const drafted: { position: Position }[] = [
      { position: "WR" },
      { position: "WR" },
      { position: "RB" },
      { position: "RB" },
    ];

    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(drafted, rosterRequirements);

    expect(positionCounts.WR).toBe(2);
    expect(positionCounts.RB).toBe(2);
    expect(positionCounts.FLEX).toBe(1);
    expect(positionNeeds.FLEX).toBe(0);
  });

  it("only allocates to FLEX for FLEX-eligible positions (RB/WR/TE)", () => {
    const rosterRequirements: Record<RosterSlot, number> = {
      QB: 1,
      RB: 1,
      WR: 1,
      TE: 1,
      FLEX: 1,
      K: 0,
      DEF: 0,
      BN: 0,
    };

    // Draft two QBs (only one can fill QB), and draft an extra WR to fill FLEX
    const drafted: { position: Position }[] = [
      { position: "QB" },
      { position: "QB" }, // not FLEX-eligible
      { position: "WR" }, // fills WR
      { position: "WR" }, // should go to FLEX
      { position: "RB" }, // fills RB
      { position: "TE" }, // fills TE
    ];

    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(drafted, rosterRequirements);

    // First QB fills QB, second QB should NOT go to FLEX
    expect(positionCounts.QB).toBe(2);
    // Extra WR should be assigned to FLEX
    expect(positionCounts.FLEX).toBe(1);
    // FLEX needs should be 0 after allocation
    expect(positionNeeds.FLEX).toBe(0);
  });

  it("should show actual roster requirements in position counts display", () => {
    const rosterRequirements: Record<RosterSlot, number> = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DEF: 1,
      BN: 0,
    };

    // Drafted: 4 WR (exceeds the 2 WR requirement), 1 QB
    const drafted: { position: Position }[] = [
      { position: "QB" },
      { position: "WR" },
      { position: "WR" },
      { position: "WR" },
      { position: "WR" },
    ];

    const { positionNeeds, positionCounts } =
      calculateTeamNeedsAndCountsForSingleTeam(drafted, rosterRequirements);

    // Position counts should show actual numbers
    expect(positionCounts.WR).toBe(4);
    expect(positionCounts.QB).toBe(1);

    // But needs should be calculated based on requirements
    expect(positionNeeds.WR).toBe(0); // 4 >= 2, so no WR needed
    expect(positionNeeds.QB).toBe(0); // 1 >= 1, so no QB needed

    // FLEX should get the extras up to FLEX requirement (1 extra WR beyond the 2 required)
    expect(positionCounts.FLEX).toBe(1);
    expect(positionNeeds.FLEX).toBe(0); // 1 >= 1, so FLEX requirement satisfied
  });
});
