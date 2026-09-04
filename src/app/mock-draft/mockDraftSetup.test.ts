import { describe, expect, it } from "vitest";

import {
  defaultMockDraftSetup,
  mockDraftConfigFromSetup,
  mockDraftSettingsFromLeague,
  mockDraftSetupSchema,
  mockDraftSetupToScoringRules,
} from "@/app/mock-draft/mockDraftSetup";

describe("mock draft setup", () => {
  it.each(["QB", "TE", "K", "DEF"] as const)(
    "rejects more than one %s slot",
    (position) => {
      const result = mockDraftSetupSchema.safeParse({
        ...defaultMockDraftSetup,
        [position]: 2,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: [position] })
      );
    }
  );

  it("keeps future keeper policy as explicit configuration metadata", () => {
    const config = mockDraftConfigFromSetup(defaultMockDraftSetup, {
      season: "2026",
      userId: "mock-user",
      leagueName: "Mock League",
    });

    expect(config.keeperPolicy).toEqual({
      startsInSeason: 2027,
      maxPerTeam: 1,
      eligibility: "drafted-only",
      cost: "same-round",
      customRoundPenalty: null,
    });
    expect(config.rounds).toBe(14);
    expect(config).not.toHaveProperty("strategy");
    expect(defaultMockDraftSetup).not.toHaveProperty("strategy");
  });

  it("preserves unsupported imported scoring and reports normalized formats", () => {
    const imported = mockDraftSettingsFromLeague({
      league_id: "custom-league",
      name: "Custom League",
      season: "2026",
      total_rosters: 12,
      roster_positions: [
        "QB",
        "RB",
        "RB",
        "WR",
        "WR",
        "TE",
        "SUPER_FLEX",
        "DEF",
        "BN",
      ],
      scoring_settings: {
        rec: 0.69,
        sack: 2,
        bonus_rec_te: 0.5,
      },
    });

    expect(imported.scoringRules.defense).toBe("unsupported-custom");
    expect(imported.notices.map((notice) => notice.code)).toEqual(
      expect.arrayContaining(["SUPER_FLEX", "TE_PREMIUM", "CUSTOM_DEFENSE"])
    );
    expect(mockDraftSetupToScoringRules({
      ...defaultMockDraftSetup,
      defense: imported.scoringRules.defense,
    }).defense).toBe("unsupported-custom");
  });
});
