import { z } from "zod";

import type { DraftDetails } from "@/lib/draftDetails";
import {
  parseSleeperScoringType,
  scoringTypeFromReceptionPoints,
} from "@/lib/scoring";
import { scoringTypeSchema, type ScoringType } from "@/lib/schemas";
import type { SleeperLeague } from "@/lib/sleeper";

export const DraftRosterSlotsSchema = z.object({
  QB: z.number().int().min(0).max(4),
  RB: z.number().int().min(0).max(8),
  WR: z.number().int().min(0).max(8),
  TE: z.number().int().min(0).max(4),
  K: z.number().int().min(0).max(4),
  DEF: z.number().int().min(0).max(4),
  FLEX: z.number().int().min(0).max(6),
  BENCH: z.number().int().min(0).max(20),
  IR: z.number().int().min(0).max(10),
});

export type DraftRosterSlots = z.infer<typeof DraftRosterSlotsSchema>;

export const DraftScoringRulesSchema = z.object({
  reception: z.number(),
  rushingYard: z.number(),
  receivingYard: z.number(),
  rushingTouchdown: z.number(),
  receivingTouchdown: z.number(),
  passingYard: z.number(),
  passingTouchdown: z.number(),
  interception: z.number(),
  lostFumble: z.number(),
  pointsPerCarry: z.number(),
  defense: z.enum(["sleeper-standard", "unsupported-custom"]),
  fieldGoalUnder50: z.number(),
  fieldGoal50Plus: z.number(),
  extraPoint: z.number(),
  missedFieldGoal: z.number(),
  missedExtraPoint: z.number(),
});

export type DraftScoringRules = z.infer<typeof DraftScoringRulesSchema>;

export const KeeperPolicySchema = z
  .object({
    startsInSeason: z.number().int().min(2026),
    maxPerTeam: z.number().int().min(0).max(10),
    eligibility: z.enum(["drafted-only", "any-rostered"]),
    cost: z.enum(["none", "same-round", "previous-round", "custom-round-penalty"]),
    customRoundPenalty: z.number().int().min(1).max(10).nullable(),
  })
  .superRefine((policy, context) => {
    if (policy.cost === "custom-round-penalty" && policy.customRoundPenalty == null) {
      context.addIssue({
        code: "custom",
        message: "A custom keeper round penalty is required.",
        path: ["customRoundPenalty"],
      });
    }
  });

export type KeeperPolicy = z.infer<typeof KeeperPolicySchema>;

export const SleeperDraftLeagueConfigSchema = z.object({
  source: z.literal("sleeper-draft"),
  teams: z.number().int().min(2),
  rounds: z.number().int().min(1),
  userSlot: z.number().int().min(1).nullable(),
  draftType: z.string().min(1),
  draftOrderMode: z.enum(["sleeper", "manual"]),
  pickTimerSeconds: z.number().int().min(1).nullable(),
  scoring: scoringTypeSchema,
  scoringSource: z.enum(["draft", "league", "metadata"]),
  scoringRules: DraftScoringRulesSchema,
  rosterSlots: DraftRosterSlotsSchema,
});

export type SleeperDraftLeagueConfig = z.infer<
  typeof SleeperDraftLeagueConfigSchema
>;

export type UnsupportedDraftFormatNotice = {
  code:
    | "AUCTION"
    | "NON_SNAKE"
    | "MULTI_QB"
    | "MULTI_TE"
    | "MULTI_K"
    | "MULTI_DEF"
    | "SUPER_FLEX"
    | "REC_FLEX"
    | "IDP"
    | "TE_PREMIUM"
    | "POINTS_PER_CARRY"
    | "TWO_POINT_CONVERSION"
    | "CUSTOM_DEFENSE"
    | "UNMODELED_SCORING"
    | "KICKER_PROJECTION_GAP";
  message: string;
};

export const DEFAULT_DRAFT_ROSTER_SLOTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 0,
  DEF: 1,
  FLEX: 2,
  BENCH: 5,
  IR: 1,
} as const satisfies DraftRosterSlots;

export const DEFAULT_DRAFT_SCORING_RULES = {
  reception: 0.69,
  rushingYard: 0.1,
  receivingYard: 0.1,
  rushingTouchdown: 6,
  receivingTouchdown: 6,
  passingYard: 0.04,
  passingTouchdown: 4,
  interception: -1,
  lostFumble: -2,
  pointsPerCarry: 0,
  defense: "sleeper-standard",
  fieldGoalUnder50: 3,
  fieldGoal50Plus: 5,
  extraPoint: 1,
  missedFieldGoal: -1,
  missedExtraPoint: -1,
} as const satisfies DraftScoringRules;

export const DEFAULT_KEEPER_POLICY = {
  startsInSeason: 2027,
  maxPerTeam: 1,
  eligibility: "drafted-only",
  cost: "same-round",
  customRoundPenalty: null,
} as const satisfies KeeperPolicy;

const DRAFTED_ROSTER_KEYS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "FLEX",
  "BENCH",
] as const satisfies readonly (keyof DraftRosterSlots)[];

const KICKER_UNDER_50_SCORING_KEYS = [
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm",
] as const;

export function calculateDraftRounds(rosterSlots: DraftRosterSlots) {
  return DRAFTED_ROSTER_KEYS.reduce((total, slot) => total + rosterSlots[slot], 0);
}

export function rankingScoringFromRules(rules: DraftScoringRules): ScoringType {
  return scoringTypeFromReceptionPoints(rules.reception);
}

export function keepersPerTeamForSeason(policy: KeeperPolicy, season: string | number) {
  const numericSeason = Number(season);
  if (!Number.isInteger(numericSeason) || numericSeason < policy.startsInSeason) return 0;
  return policy.maxPerTeam;
}

export function rosterSlotsFromSleeperLeague(league: SleeperLeague): DraftRosterSlots {
  const counts: DraftRosterSlots = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
    FLEX: 0,
    BENCH: 0,
    IR: 0,
  };
  if (!league.roster_positions?.length) return { ...DEFAULT_DRAFT_ROSTER_SLOTS };

  for (const raw of league.roster_positions) {
    if (raw === "BN" || raw === "BE") {
      counts.BENCH += 1;
    } else if (raw === "IR") {
      counts.IR += 1;
    } else if (raw === "SUPER_FLEX" || raw === "REC_FLEX") {
      counts.FLEX += 1;
    } else if (
      raw === "QB" ||
      raw === "RB" ||
      raw === "WR" ||
      raw === "TE" ||
      raw === "K" ||
      raw === "DEF" ||
      raw === "FLEX"
    ) {
      counts[raw] += 1;
    }
  }
  return counts;
}

export function draftLeagueConfigFromSleeperDraft(
  draft: DraftDetails,
  userId: string,
  league?: SleeperLeague,
  manualUserSlot?: number
): SleeperDraftLeagueConfig {
  const draftScoring = draft.scoring_settings;
  const leagueScoring = league?.scoring_settings;
  const scoringSettings = hasScoringSettings(draftScoring)
    ? draftScoring
    : hasScoringSettings(leagueScoring)
      ? leagueScoring
      : undefined;
  const scoringSource = hasScoringSettings(draftScoring)
    ? "draft"
    : hasScoringSettings(leagueScoring)
      ? "league"
      : "metadata";
  const scoringRules = scoringRulesFromSleeperSettings(
    scoringSettings,
    receptionPointsFromScoringType(
      parseSleeperScoringType(draft.metadata.scoring_type)
    )
  );
  const starterCount =
    draft.settings.slots_qb +
    draft.settings.slots_rb +
    draft.settings.slots_wr +
    draft.settings.slots_te +
    draft.settings.slots_k +
    draft.settings.slots_def +
    draft.settings.slots_flex;
  const sleeperUserSlot = draft.draft_order[userId] ?? null;
  const validManualUserSlot =
    manualUserSlot != null &&
    Number.isInteger(manualUserSlot) &&
    manualUserSlot >= 1 &&
    manualUserSlot <= draft.settings.teams
      ? manualUserSlot
      : null;
  const userSlot = sleeperUserSlot ?? validManualUserSlot;
  return SleeperDraftLeagueConfigSchema.parse({
    source: "sleeper-draft",
    teams: draft.settings.teams,
    rounds: draft.settings.rounds,
    userSlot,
    draftType: draft.type,
    draftOrderMode:
      sleeperUserSlot != null || userSlot == null ? "sleeper" : "manual",
    pickTimerSeconds: draft.settings.pick_timer ?? null,
    scoring: rankingScoringFromRules(scoringRules),
    scoringSource,
    scoringRules,
    rosterSlots: {
      QB: draft.settings.slots_qb,
      RB: draft.settings.slots_rb,
      WR: draft.settings.slots_wr,
      TE: draft.settings.slots_te,
      K: draft.settings.slots_k,
      DEF: draft.settings.slots_def,
      FLEX: draft.settings.slots_flex,
      BENCH:
        draft.settings.slots_bn ??
        Math.max(0, draft.settings.rounds - starterCount),
      IR: draft.settings.slots_ir ?? 0,
    },
  });
}

export function getUnsupportedDraftFormatNotices(
  draft: DraftDetails,
  league?: SleeperLeague
): UnsupportedDraftFormatNotice[] {
  const notices: UnsupportedDraftFormatNotice[] = [];
  const draftType = draft.type?.trim().toLowerCase();
  if (draftType === "auction") {
    notices.push({
      code: "AUCTION",
      message: "Auction pricing and nomination strategy are not considered.",
    });
  } else if (draftType && draftType !== "snake") {
    notices.push({
      code: "NON_SNAKE",
      message: `${draft.type} draft timing is not considered.`,
    });
  }

  if (draft.settings.slots_qb > 1) {
    notices.push({
      code: "MULTI_QB",
      message:
        "Multiple starting quarterbacks are not supported; recommendations stop at one QB.",
    });
  }
  if (draft.settings.slots_te > 1) {
    notices.push({
      code: "MULTI_TE",
      message:
        "Multiple starting tight ends are not supported; recommendations stop at one TE.",
    });
  }
  if (draft.settings.slots_k > 1) {
    notices.push({
      code: "MULTI_K",
      message:
        "Multiple starting kickers are not supported; recommendations stop at one K.",
    });
  }
  if (draft.settings.slots_def > 1) {
    notices.push({
      code: "MULTI_DEF",
      message:
        "Multiple starting defenses are not supported; recommendations stop at one D/ST.",
    });
  }

  const rosterPositions = new Set(league?.roster_positions ?? []);
  if (rosterPositions.has("SUPER_FLEX")) {
    notices.push({
      code: "SUPER_FLEX",
      message: "Superflex quarterback value is not considered.",
    });
  }
  if (rosterPositions.has("REC_FLEX")) {
    notices.push({
      code: "REC_FLEX",
      message: "WR/TE-only flex eligibility is treated as standard FLEX.",
    });
  }
  if (["DL", "DE", "DT", "LB", "DB", "CB", "S", "IDP_FLEX"].some(
    (position) => rosterPositions.has(position)
  )) {
    notices.push({
      code: "IDP",
      message: "Individual defensive player positions are not considered.",
    });
  }

  const scoring = hasScoringSettings(draft.scoring_settings)
    ? draft.scoring_settings
    : league?.scoring_settings;
  if (["bonus_rec_te", "rec_te", "rec_yd_te", "rec_td_te"].some(
    (key) => (readNumber(scoring, key) ?? 0) !== 0
  )) {
    notices.push({
      code: "TE_PREMIUM",
      message: "Tight end premium scoring is not considered.",
    });
  }
  if ((readNumber(scoring, "rush_att") ?? 0) !== 0) {
    notices.push({
      code: "POINTS_PER_CARRY",
      message: "Points per carry scoring is not considered.",
    });
  }
  if (["pass_2pt", "rush_2pt", "rec_2pt"].some(
    (key) => (readNumber(scoring, key) ?? 0) !== 0
  )) {
    notices.push({
      code: "TWO_POINT_CONVERSION",
      message: "Two-point conversion scoring is not included in starter-aware value.",
    });
  }
  if (draft.settings.slots_def > 0 && hasCustomDefenseScoring(scoring)) {
    notices.push({
      code: "CUSTOM_DEFENSE",
      message:
        "Custom D/ST scoring is not included in starter-aware value, so draft recommendations are unavailable.",
    });
  }
  const unmodeledScoringKeys = getUnmodeledScoringKeys(scoring);
  if (unmodeledScoringKeys.length > 0) {
    notices.push({
      code: "UNMODELED_SCORING",
      message:
        `Starter-aware value does not include these scoring rules: ${unmodeledScoringKeys.join(", ")}.`,
    });
  }
  if (
    draft.settings.slots_k > 0 &&
    KICKER_UNDER_50_SCORING_KEYS.some(
      (key) => (readNumber(scoring, key) ?? 0) !== 0
    )
  ) {
    notices.push({
      code: "KICKER_PROJECTION_GAP",
      message:
        "Starter-aware kicker Val uses Sleeper standard projected points because made field-goal distance splits are not available.",
    });
  }

  return notices;
}

function hasScoringSettings(
  scoring: Record<string, unknown> | undefined
): scoring is Record<string, unknown> {
  return scoring != null && Object.keys(scoring).length > 0;
}

export function scoringRulesFromSleeperLeague(league: SleeperLeague): DraftScoringRules {
  return scoringRulesFromSleeperSettings(league.scoring_settings);
}

export function scoringRulesFromSleeperSettings(
  scoring: Record<string, unknown> | undefined,
  fallbackReception: number = DEFAULT_DRAFT_SCORING_RULES.reception
): DraftScoringRules {
  const fallback = hasScoringSettings(scoring)
    ? ZERO_DRAFT_SCORING_RULES
    : { ...DEFAULT_DRAFT_SCORING_RULES, reception: fallbackReception };
  return DraftScoringRulesSchema.parse({
    reception: readNumber(scoring, "rec") ?? fallback.reception,
    rushingYard: readNumber(scoring, "rush_yd") ?? fallback.rushingYard,
    receivingYard: readNumber(scoring, "rec_yd") ?? fallback.receivingYard,
    rushingTouchdown: readNumber(scoring, "rush_td") ?? fallback.rushingTouchdown,
    receivingTouchdown:
      readNumber(scoring, "rec_td") ?? fallback.receivingTouchdown,
    passingYard: readNumber(scoring, "pass_yd") ?? fallback.passingYard,
    passingTouchdown:
      readNumber(scoring, "pass_td") ?? fallback.passingTouchdown,
    interception: readNumber(scoring, "pass_int") ?? fallback.interception,
    lostFumble: readNumber(scoring, "fum_lost") ?? fallback.lostFumble,
    pointsPerCarry: readNumber(scoring, "rush_att") ?? fallback.pointsPerCarry,
    defense: hasCustomDefenseScoring(scoring)
      ? "unsupported-custom"
      : "sleeper-standard",
    fieldGoalUnder50: readKickerUnder50(scoring, fallback.fieldGoalUnder50),
    fieldGoal50Plus: readNumber(scoring, "fgm_50p") ?? fallback.fieldGoal50Plus,
    extraPoint: readNumber(scoring, "xpm") ?? fallback.extraPoint,
    missedFieldGoal: readNumber(scoring, "fgmiss") ?? fallback.missedFieldGoal,
    missedExtraPoint: readNumber(scoring, "xpmiss") ?? fallback.missedExtraPoint,
  });
}

function receptionPointsFromScoringType(scoring: ScoringType) {
  if (scoring === "ppr") return 1;
  if (scoring === "half") return 0.5;
  return 0;
}

const ZERO_DRAFT_SCORING_RULES = {
  reception: 0,
  rushingYard: 0,
  receivingYard: 0,
  rushingTouchdown: 0,
  receivingTouchdown: 0,
  passingYard: 0,
  passingTouchdown: 0,
  interception: 0,
  lostFumble: 0,
  pointsPerCarry: 0,
  defense: "sleeper-standard",
  fieldGoalUnder50: 0,
  fieldGoal50Plus: 0,
  extraPoint: 0,
  missedFieldGoal: 0,
  missedExtraPoint: 0,
} as const satisfies DraftScoringRules;

export const SLEEPER_STANDARD_DEFENSE_SCORING = {
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
} as const;

const CUSTOM_DEFENSE_SCORING_KEYS = [
  "pts_allow",
  "yds_allow",
  "yds_allow_0_100",
  "yds_allow_100_199",
  "yds_allow_200_299",
  "yds_allow_300_349",
  "yds_allow_350_399",
  "yds_allow_400_449",
  "yds_allow_450_499",
  "yds_allow_500_549",
  "yds_allow_550p",
  "qb_hit",
  "sack_yd",
  "int_ret_yd",
  "fum_ret_yd",
  "tkl_loss",
  "tkl_ast",
  "tkl_solo",
  "tkl",
  "def_pass_def",
  "def_2pt",
  "blk_kick_ret_yd",
  "fg_ret_yd",
] as const;

const MODELED_OR_SEPARATELY_REPORTED_SCORING_KEYS = new Set([
  "rec",
  "rush_yd",
  "rec_yd",
  "rush_td",
  "rec_td",
  "pass_yd",
  "pass_td",
  "pass_int",
  "fum_lost",
  "rush_att",
  "pass_2pt",
  "rush_2pt",
  "rec_2pt",
  "bonus_rec_te",
  "rec_te",
  "rec_yd_te",
  "rec_td_te",
  "fgm",
  "fgm_0_19",
  "fgm_20_29",
  "fgm_30_39",
  "fgm_40_49",
  "fgm_50p",
  "xpm",
  "fgmiss",
  "xpmiss",
  ...Object.keys(SLEEPER_STANDARD_DEFENSE_SCORING),
  ...CUSTOM_DEFENSE_SCORING_KEYS,
]);

function hasCustomDefenseScoring(
  scoring: Record<string, unknown> | undefined
) {
  if (!scoring) return false;
  for (const [key, standardValue] of Object.entries(
    SLEEPER_STANDARD_DEFENSE_SCORING
  )) {
    const configured = readNumber(scoring, key) ?? 0;
    if (Math.abs(configured - standardValue) > 0.0001) {
      return true;
    }
  }
  return CUSTOM_DEFENSE_SCORING_KEYS.some(
    (key) => (readNumber(scoring, key) ?? 0) !== 0
  );
}

function getUnmodeledScoringKeys(
  scoring: Record<string, unknown> | undefined
) {
  if (!scoring) return [];
  return Object.keys(scoring)
    .filter(
      (key) =>
        !MODELED_OR_SEPARATELY_REPORTED_SCORING_KEYS.has(key) &&
        (readNumber(scoring, key) ?? 0) !== 0
    )
    .sort();
}

function readKickerUnder50(
  scoring: Record<string, unknown> | undefined,
  fallback: number
) {
  const values = KICKER_UNDER_50_SCORING_KEYS.flatMap((key) => {
    const value = readNumber(scoring, key);
    return value == null ? [] : [value];
  });
  return values.find((value) => value !== 0) ?? values[0] ?? fallback;
}

function readNumber(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}
