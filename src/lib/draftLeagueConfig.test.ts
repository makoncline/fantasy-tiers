import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
  DEFAULT_KEEPER_POLICY,
  KeeperPolicySchema,
  calculateDraftRounds,
  draftLeagueConfigFromSleeperDraft,
  getUnsupportedDraftFormatNotices,
  keepersPerTeamForSeason,
  rankingScoringFromRules,
} from "@/lib/draftLeagueConfig";
import { DraftDetailsSchema } from "@/lib/draftDetails";
import {
  advanceToEnd,
  createDefaultSimDraftConfig,
  createSimDraft,
  getSimDraftSnapshot,
  toSleeperDraftDetails,
  type SimDraftPlayer,
} from "@/lib/simDraft";

describe("draft league configuration", () => {
  it("preserves the league ID embedded in league-mock metadata", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "league-mock",
      league_id: null,
      metadata: {
        league_id: "actual-league",
        scoring_type: "ppr",
      },
      settings: { teams: 12, rounds: 14 },
    });

    expect(draft.metadata.league_id).toBe("actual-league");
  });

  it("uses the selected Sleeper draft as the live league configuration", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "public-draft",
      type: "linear",
      season: "2026",
      metadata: { name: "Different League", scoring_type: "half_ppr" },
      settings: {
        teams: 10,
        rounds: 17,
        pick_timer: 90,
        slots_qb: 2,
        slots_rb: 2,
        slots_wr: 3,
        slots_te: 1,
        slots_k: 1,
        slots_def: 0,
        slots_flex: 1,
        slots_bn: 7,
        slots_ir: 3,
      },
      scoring_settings: {
        rec: 0.5,
        rush_yd: 0.08,
        rec_yd: 0.12,
        rush_td: 6,
        rec_td: 6,
        pass_yd: 0.05,
        pass_td: 6,
        pass_int: -2,
        fum_lost: -3,
        rush_att: 0.2,
        fgm: 3,
        fgm_50p: 6,
        xpm: 1,
        fgmiss: -2,
        xpmiss: -1,
      },
      draft_order: { "public-user": 7 },
      slot_to_roster_id: {},
    });

    expect(draftLeagueConfigFromSleeperDraft(draft, "public-user")).toEqual({
      source: "sleeper-draft",
      teams: 10,
      rounds: 17,
      userSlot: 7,
      draftType: "linear",
      draftOrderMode: "sleeper",
      pickTimerSeconds: 90,
      scoring: "half",
      scoringSource: "draft",
      scoringRules: {
        reception: 0.5,
        rushingYard: 0.08,
        receivingYard: 0.12,
        rushingTouchdown: 6,
        receivingTouchdown: 6,
        passingYard: 0.05,
        passingTouchdown: 6,
        interception: -2,
        lostFumble: -3,
        pointsPerCarry: 0.2,
        defense: "unsupported-custom",
        fieldGoalUnder50: 3,
        fieldGoal50Plus: 6,
        extraPoint: 1,
        missedFieldGoal: -2,
        missedExtraPoint: -1,
      },
      rosterSlots: {
        QB: 2,
        RB: 2,
        WR: 3,
        TE: 1,
        K: 1,
        DEF: 0,
        FLEX: 1,
        BENCH: 7,
        IR: 3,
      },
    });
  });

  it("uses a manual slot only while Sleeper has no draft order", () => {
    const unorderedDraft = DraftDetailsSchema.parse({
      draft_id: "unordered-draft",
      type: "snake",
      metadata: { scoring_type: "ppr" },
      settings: { teams: 12, rounds: 14 },
      draft_order: null,
    });
    const orderedDraft = DraftDetailsSchema.parse({
      ...unorderedDraft,
      draft_order: { "public-user": 9 },
    });

    expect(
      draftLeagueConfigFromSleeperDraft(
        unorderedDraft,
        "public-user",
        undefined,
        4
      )
    ).toMatchObject({ userSlot: 4, draftOrderMode: "manual" });
    expect(
      draftLeagueConfigFromSleeperDraft(
        orderedDraft,
        "public-user",
        undefined,
        4
      )
    ).toMatchObject({ userSlot: 9, draftOrderMode: "sleeper" });
  });

  it("uses the planned 2026 league preset end to end", () => {
    const config = createDefaultSimDraftConfig();
    const draft = toSleeperDraftDetails(createSimDraft(config));

    expect(config).toMatchObject({
      teams: 12,
      userSlot: 4,
      rounds: 14,
      draftType: "snake",
      draftOrderMode: "manual",
      pickTimerSeconds: 60,
      scoring: "ppr",
      rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
      keeperPolicy: DEFAULT_KEEPER_POLICY,
    });
    expect(draft.settings).toMatchObject({
      teams: 12,
      rounds: 14,
      pick_timer: 60,
      slots_flex: 2,
      slots_k: 0,
      slots_def: 1,
      slots_bn: 5,
      slots_ir: 1,
    });
    expect(draft.draft_order[config.userId]).toBe(4);
    expect(draft.scoring_settings).toMatchObject({
      rec: 0.69,
      rush_yd: 0.1,
      rec_yd: 0.1,
      rush_td: 6,
      rec_td: 6,
      pass_yd: 0.04,
      pass_td: 4,
      pass_int: -1,
      fum_lost: -2,
      rush_att: 0,
      fgm_40_49: 3,
      fgm_50p: 5,
      xpm: 1,
      fgmiss: -1,
      xpmiss: -1,
      sack: 1,
      int: 2,
      def_td: 6,
      pts_allow_0: 10,
      pts_allow_35p: -4,
    });
    expect(
      draftLeagueConfigFromSleeperDraft(draft, config.userId).scoringRules
        .defense
    ).toBe("sleeper-standard");
  });

  it.each([
    { flex: 2, kicker: 0, rounds: 14 },
    { flex: 2, kicker: 1, rounds: 15 },
    { flex: 1, kicker: 1, rounds: 14 },
    { flex: 1, kicker: 0, rounds: 13 },
  ])("calculates $rounds rounds for FLEX $flex and K $kicker", ({ flex, kicker, rounds }) => {
    expect(
      calculateDraftRounds({
        ...DEFAULT_DRAFT_ROSTER_SLOTS,
        FLEX: flex,
        K: kicker,
      })
    ).toBe(rounds);
  });

  it("does not count IR as a draft round", () => {
    expect(
      calculateDraftRounds({ ...DEFAULT_DRAFT_ROSTER_SLOTS, IR: 4 })
    ).toBe(14);
  });

  it("maps 0.69 reception scoring to the PPR ranking pool", () => {
    expect(rankingScoringFromRules(DEFAULT_DRAFT_SCORING_RULES)).toBe("ppr");
  });

  it("does not fill omitted live scoring fields from the owner preset", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "standard-draft",
      type: "snake",
      metadata: { scoring_type: "std" },
      settings: {
        teams: 8,
        rounds: 10,
        pick_timer: 30,
        slots_qb: 1,
        slots_rb: 1,
        slots_wr: 1,
        slots_te: 1,
        slots_k: 0,
        slots_def: 0,
        slots_flex: 1,
        slots_bn: 5,
      },
      scoring_settings: { pass_td: 6 },
      draft_order: { user: 1 },
      slot_to_roster_id: {},
    });

    const config = draftLeagueConfigFromSleeperDraft(draft, "user");

    expect(config.scoringRules).toMatchObject({
      reception: 0,
      rushingYard: 0,
      receivingYard: 0,
      passingTouchdown: 6,
      interception: 0,
      fieldGoalUnder50: 0,
    });
  });

  it("names format rules that the recommendation model does not consider", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "unsupported-draft",
      type: "auction",
      metadata: { scoring_type: "ppr" },
      settings: { teams: 12, rounds: 16 },
      scoring_settings: { rec: 1, rush_att: 0.25, bonus_rec_te: 0.5 },
      draft_order: {},
      slot_to_roster_id: {},
    });

    expect(draftLeagueConfigFromSleeperDraft(draft, "user").draftType).toBe(
      "auction"
    );

    expect(
      getUnsupportedDraftFormatNotices(draft, {
        league_id: "unsupported-league",
        name: "Unsupported League",
        roster_positions: ["QB", "SUPER_FLEX", "IDP_FLEX", "BN"],
        scoring_settings: { rec: 1, rush_att: 0.25, bonus_rec_te: 0.5 },
      })
    ).toEqual([
      {
        code: "AUCTION",
        message: "Auction pricing and nomination strategy are not considered.",
      },
      {
        code: "SUPER_FLEX",
        message: "Superflex quarterback value is not considered.",
      },
      {
        code: "IDP",
        message: "Individual defensive player positions are not considered.",
      },
      {
        code: "TE_PREMIUM",
        message: "Tight end premium scoring is not considered.",
      },
      {
        code: "POINTS_PER_CARRY",
        message: "Points per carry scoring is not considered.",
      },
    ]);
  });

  it("names two-point and exact-kicker limits from Sleeper settings", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "scoring-limit-draft",
      type: "snake",
      metadata: { scoring_type: "ppr" },
      settings: {
        teams: 12,
        rounds: 15,
        slots_k: 1,
      },
      scoring_settings: {
        rec: 0.69,
        pass_2pt: 2,
        rush_2pt: 2,
        rec_2pt: 2,
        fgm_40_49: 3,
        fgm_50p: 5,
      },
      draft_order: {},
      slot_to_roster_id: {},
    });

    expect(getUnsupportedDraftFormatNotices(draft)).toEqual(
      expect.arrayContaining([
        {
          code: "TWO_POINT_CONVERSION",
          message: "Two-point conversion scoring is not included in starter-aware value.",
        },
        {
          code: "KICKER_PROJECTION_GAP",
          message:
            "Starter-aware kicker Val uses Sleeper standard projected points because made field-goal distance splits are not available.",
        },
      ])
    );
  });

  it("warns when capped roster positions require more than one starter", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "multiple-onesie-draft",
      type: "snake",
      metadata: { scoring_type: "ppr" },
      settings: {
        teams: 12,
        rounds: 16,
        slots_qb: 2,
        slots_te: 2,
        slots_k: 2,
        slots_def: 2,
      },
      scoring_settings: { rec: 1 },
      draft_order: {},
      slot_to_roster_id: {},
    });

    expect(getUnsupportedDraftFormatNotices(draft)).toEqual(
      expect.arrayContaining([
        {
          code: "MULTI_QB",
          message:
            "Multiple starting quarterbacks are not supported; recommendations stop at one QB.",
        },
        {
          code: "MULTI_TE",
          message:
            "Multiple starting tight ends are not supported; recommendations stop at one TE.",
        },
        {
          code: "MULTI_K",
          message:
            "Multiple starting kickers are not supported; recommendations stop at one K.",
        },
        {
          code: "MULTI_DEF",
          message:
            "Multiple starting defenses are not supported; recommendations stop at one D/ST.",
        },
      ])
    );
  });

  it("marks custom D/ST scoring as unsupported for starter-aware value", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "custom-defense-draft",
      type: "snake",
      metadata: { scoring_type: "ppr" },
      settings: { teams: 12, rounds: 14, slots_def: 1 },
      scoring_settings: { rec: 1, sack: 2, int: 2 },
      draft_order: {},
      slot_to_roster_id: {},
    });

    expect(
      draftLeagueConfigFromSleeperDraft(draft, "user").scoringRules.defense
    ).toBe("unsupported-custom");
    expect(getUnsupportedDraftFormatNotices(draft)).toContainEqual({
      code: "CUSTOM_DEFENSE",
      message:
        "Custom D/ST scoring is not included in starter-aware value, so draft recommendations are unavailable.",
    });
  });

  it("accepts Sleeper standard D/ST scoring with defense special-team aliases", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "standard-defense-draft",
      type: "snake",
      metadata: { scoring_type: "ppr" },
      settings: { teams: 12, rounds: 14, slots_def: 1 },
      scoring_settings: {
        sack: 1,
        int: 2,
        fum_rec: 2,
        fum_rec_td: 6,
        safe: 2,
        blk_kick: 2,
        def_td: 6,
        st_td: 6,
        st_fum_rec: 1,
        st_ff: 1,
        def_st_td: 6,
        def_st_fum_rec: 1,
        def_st_ff: 1,
        ff: 1,
        pts_allow_0: 10,
        pts_allow_1_6: 7,
        pts_allow_7_13: 4,
        pts_allow_14_20: 1,
        pts_allow_21_27: 0,
        pts_allow_28_34: -1,
        pts_allow_35p: -4,
      },
      draft_order: {},
      slot_to_roster_id: {},
    });

    expect(
      draftLeagueConfigFromSleeperDraft(draft, "user").scoringRules.defense
    ).toBe("sleeper-standard");
  });

  it("treats omitted D/ST keys as zero in nonempty live scoring settings", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "zero-defense-draft",
      type: "snake",
      metadata: { scoring_type: "ppr" },
      settings: { teams: 12, rounds: 14, slots_def: 1 },
      scoring_settings: { rec: 1 },
      draft_order: {},
      slot_to_roster_id: {},
    });

    expect(
      draftLeagueConfigFromSleeperDraft(draft, "user").scoringRules.defense
    ).toBe("unsupported-custom");
    expect(getUnsupportedDraftFormatNotices(draft)).toContainEqual(
      expect.objectContaining({ code: "CUSTOM_DEFENSE" })
    );
  });

  it("names nonzero scoring rules that the value model does not include", () => {
    const draft = DraftDetailsSchema.parse({
      draft_id: "bonus-scoring-draft",
      type: "snake",
      metadata: { scoring_type: "ppr" },
      settings: { teams: 12, rounds: 14 },
      scoring_settings: {
        rec: 1,
        bonus_pass_yd_300: 3,
        bonus_rush_rec_yd_100: 2,
      },
      draft_order: {},
      slot_to_roster_id: {},
    });

    expect(getUnsupportedDraftFormatNotices(draft)).toContainEqual({
      code: "UNMODELED_SCORING",
      message:
        "Starter-aware value does not include these scoring rules: bonus_pass_yd_300, bonus_rush_rec_yd_100.",
    });
  });

  it("explains the starter-aware kicker input for every under-40 scoring range", () => {
    for (const scoringKey of ["fgm_0_19", "fgm_20_29", "fgm_30_39"] as const) {
      const draft = DraftDetailsSchema.parse({
        draft_id: `kicker-${scoringKey}`,
        type: "snake",
        metadata: { scoring_type: "ppr" },
        settings: { teams: 12, rounds: 15, slots_k: 1 },
        scoring_settings: { [scoringKey]: 3 },
        draft_order: {},
        slot_to_roster_id: {},
      });

      expect(
        draftLeagueConfigFromSleeperDraft(draft, "user")
          .scoringRules.fieldGoalUnder50
      ).toBe(3);
      expect(getUnsupportedDraftFormatNotices(draft)).toContainEqual({
        code: "KICKER_PROJECTION_GAP",
        message:
          "Starter-aware kicker Val uses Sleeper standard projected points because made field-goal distance splits are not available.",
      });
    }
  });

  it("activates the one-keeper policy in 2027", () => {
    expect(keepersPerTeamForSeason(DEFAULT_KEEPER_POLICY, 2026)).toBe(0);
    expect(keepersPerTeamForSeason(DEFAULT_KEEPER_POLICY, 2027)).toBe(1);
  });

  it("requires a value for a custom-round keeper penalty", () => {
    expect(
      KeeperPolicySchema.safeParse({
        ...DEFAULT_KEEPER_POLICY,
        cost: "custom-round-penalty",
        customRoundPenalty: null,
      }).success
    ).toBe(false);
  });

  it("makes every simulated team follow the configured K and D/ST limits", () => {
    const rosterSlots = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      K: 0,
      DEF: 1,
      FLEX: 0,
      BENCH: 1,
      IR: 0,
    };
    const config = createDefaultSimDraftConfig({ teams: 2, userSlot: 1, rosterSlots });
    const players = [
      player("rb1", "RB", 1),
      player("rb2", "RB", 2),
      player("def1", "DEF", 3),
      player("def2", "DEF", 4),
      player("k1", "K", 5),
      player("k2", "K", 6),
    ];
    const state = advanceToEnd(createSimDraft(config), players);
    const rosters = getSimDraftSnapshot(state, players).rostersBySlot;

    for (const roster of Object.values(rosters)) {
      expect(roster.filter((candidate) => candidate.position === "DEF")).toHaveLength(1);
      expect(roster.some((candidate) => candidate.position === "K")).toBe(false);
    }
  });
});

function player(id: string, position: SimDraftPlayer["position"], rank: number) {
  return {
    player_id: id,
    name: id,
    position,
    team: "DEN",
    bye_week: "12",
    rank,
    tier: 1,
    sleeperAdp: rank,
  } satisfies SimDraftPlayer;
}
