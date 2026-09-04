import { z } from "zod";

import type { DraftDetails } from "@/lib/draftDetails";
import {
  DEFAULT_DRAFT_SCORING_RULES,
  DraftRosterSlotsSchema,
  DraftScoringRulesSchema,
  calculateDraftRounds,
  getUnsupportedDraftFormatNotices,
  rosterSlotsFromSleeperLeague,
  scoringRulesFromSleeperLeague,
  type DraftRosterSlots,
  type DraftScoringRules,
} from "@/lib/draftLeagueConfig";
import type { SleeperLeague } from "@/lib/sleeper";
import {
  createDefaultSimDraftConfig,
  type SimDraftConfig,
  type SimRosterSlots,
} from "@/lib/simDraft";

export const mockDraftSetupSchema = z.object({
  sleeperIdentifier: z.string().trim().optional(),
  teams: z.number().int().min(2).max(20),
  userSlot: z.number().int().min(1).max(20),
  pickTimerSeconds: z.number().int().min(1).max(600),
  draftType: z.enum(["snake", "linear"]),
  botStrategy: z.enum(["sleeper-adp-needs", "sleeper-market-v1"]),
  seed: z.string().trim().min(1),
  ...DraftRosterSlotsSchema.shape,
  ...DraftScoringRulesSchema.shape,
  keeperStartsInSeason: z.number().int().min(2026).max(2100),
  keeperMaxPerTeam: z.number().int().min(0).max(10),
  keeperEligibility: z.enum(["drafted-only", "any-rostered"]),
  keeperCost: z.enum([
    "none",
    "same-round",
    "previous-round",
    "custom-round-penalty",
  ]),
  keeperCustomRoundPenalty: z.number().int().min(1).max(10),
}).superRefine((values, context) => {
  if (values.userSlot > values.teams) {
    context.addIssue({
      code: "custom",
      message: "Draft slot must be within the team count.",
      path: ["userSlot"],
    });
  }
  for (const [field, label] of [
    ["QB", "QB"],
    ["TE", "TE"],
    ["K", "K"],
    ["DEF", "D/ST"],
  ] as const) {
    if (values[field] <= 1) continue;
    context.addIssue({
      code: "custom",
      message: `${label} is limited to one roster slot in this draft assistant.`,
      path: [field],
    });
  }
});

export type MockDraftSetupValues = z.infer<typeof mockDraftSetupSchema>;

const defaultSimConfig = createDefaultSimDraftConfig();
const defaultRosterSlots = {
  ...defaultSimConfig.rosterSlots,
} satisfies SimRosterSlots;

export const defaultMockDraftSetup = {
  sleeperIdentifier: "",
  teams: defaultSimConfig.teams,
  userSlot: defaultSimConfig.userSlot,
  pickTimerSeconds: defaultSimConfig.pickTimerSeconds,
  draftType: defaultSimConfig.draftType,
  botStrategy: defaultSimConfig.botStrategy,
  seed: "slot-4-2026",
  ...defaultRosterSlots,
  reception: defaultSimConfig.scoringRules.reception,
  rushingYard: defaultSimConfig.scoringRules.rushingYard,
  receivingYard: defaultSimConfig.scoringRules.receivingYard,
  rushingTouchdown: defaultSimConfig.scoringRules.rushingTouchdown,
  receivingTouchdown: defaultSimConfig.scoringRules.receivingTouchdown,
  passingYard: defaultSimConfig.scoringRules.passingYard,
  passingTouchdown: defaultSimConfig.scoringRules.passingTouchdown,
  interception: defaultSimConfig.scoringRules.interception,
  lostFumble: defaultSimConfig.scoringRules.lostFumble,
  pointsPerCarry: defaultSimConfig.scoringRules.pointsPerCarry,
  defense: defaultSimConfig.scoringRules.defense,
  fieldGoalUnder50: defaultSimConfig.scoringRules.fieldGoalUnder50,
  fieldGoal50Plus: defaultSimConfig.scoringRules.fieldGoal50Plus,
  extraPoint: defaultSimConfig.scoringRules.extraPoint,
  missedFieldGoal: defaultSimConfig.scoringRules.missedFieldGoal,
  missedExtraPoint: defaultSimConfig.scoringRules.missedExtraPoint,
  keeperStartsInSeason: defaultSimConfig.keeperPolicy.startsInSeason,
  keeperMaxPerTeam: defaultSimConfig.keeperPolicy.maxPerTeam,
  keeperEligibility: defaultSimConfig.keeperPolicy.eligibility,
  keeperCost: defaultSimConfig.keeperPolicy.cost,
  keeperCustomRoundPenalty: 1,
} satisfies MockDraftSetupValues;

export const mockDraftRosterSlotOrder = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DEF",
  "BENCH",
  "IR",
] as const;

export const mockDraftScoringFields = [
  ["reception", "Reception"],
  ["rushingYard", "Rush yard"],
  ["receivingYard", "Receiving yard"],
  ["rushingTouchdown", "Rush TD"],
  ["receivingTouchdown", "Receiving TD"],
  ["passingYard", "Pass yard"],
  ["passingTouchdown", "Pass TD"],
  ["interception", "Interception"],
  ["lostFumble", "Lost fumble"],
  ["pointsPerCarry", "Per carry"],
  ["fieldGoalUnder50", "FG under 50"],
  ["fieldGoal50Plus", "FG 50+"],
  ["extraPoint", "Extra point"],
  ["missedFieldGoal", "Missed FG"],
  ["missedExtraPoint", "Missed XP"],
] as const satisfies readonly (
  readonly [keyof Omit<DraftScoringRules, "defense">, string]
)[];

export type NumericMockDraftSetupField = Exclude<{
  [Field in keyof MockDraftSetupValues]: MockDraftSetupValues[Field] extends number
    ? Field
    : never;
}[keyof MockDraftSetupValues], undefined>;

export function mockDraftSetupToRosterSlots(
  values: Partial<MockDraftSetupValues>
): SimRosterSlots {
  return {
    QB: values.QB ?? defaultRosterSlots.QB,
    RB: values.RB ?? defaultRosterSlots.RB,
    WR: values.WR ?? defaultRosterSlots.WR,
    TE: values.TE ?? defaultRosterSlots.TE,
    K: values.K ?? defaultRosterSlots.K,
    DEF: values.DEF ?? defaultRosterSlots.DEF,
    FLEX: values.FLEX ?? defaultRosterSlots.FLEX,
    BENCH: values.BENCH ?? defaultRosterSlots.BENCH,
    IR: values.IR ?? defaultRosterSlots.IR,
  };
}

export function mockDraftSetupToScoringRules(
  values: Partial<MockDraftSetupValues>
): DraftScoringRules {
  return DraftScoringRulesSchema.parse({
    reception: values.reception ?? DEFAULT_DRAFT_SCORING_RULES.reception,
    rushingYard: values.rushingYard ?? DEFAULT_DRAFT_SCORING_RULES.rushingYard,
    receivingYard:
      values.receivingYard ?? DEFAULT_DRAFT_SCORING_RULES.receivingYard,
    rushingTouchdown:
      values.rushingTouchdown ?? DEFAULT_DRAFT_SCORING_RULES.rushingTouchdown,
    receivingTouchdown:
      values.receivingTouchdown ?? DEFAULT_DRAFT_SCORING_RULES.receivingTouchdown,
    passingYard: values.passingYard ?? DEFAULT_DRAFT_SCORING_RULES.passingYard,
    passingTouchdown:
      values.passingTouchdown ?? DEFAULT_DRAFT_SCORING_RULES.passingTouchdown,
    interception: values.interception ?? DEFAULT_DRAFT_SCORING_RULES.interception,
    lostFumble: values.lostFumble ?? DEFAULT_DRAFT_SCORING_RULES.lostFumble,
    pointsPerCarry:
      values.pointsPerCarry ?? DEFAULT_DRAFT_SCORING_RULES.pointsPerCarry,
    defense: values.defense ?? DEFAULT_DRAFT_SCORING_RULES.defense,
    fieldGoalUnder50:
      values.fieldGoalUnder50 ?? DEFAULT_DRAFT_SCORING_RULES.fieldGoalUnder50,
    fieldGoal50Plus:
      values.fieldGoal50Plus ?? DEFAULT_DRAFT_SCORING_RULES.fieldGoal50Plus,
    extraPoint: values.extraPoint ?? DEFAULT_DRAFT_SCORING_RULES.extraPoint,
    missedFieldGoal:
      values.missedFieldGoal ?? DEFAULT_DRAFT_SCORING_RULES.missedFieldGoal,
    missedExtraPoint:
      values.missedExtraPoint ?? DEFAULT_DRAFT_SCORING_RULES.missedExtraPoint,
  });
}

export function mockDraftConfigFromSetup(
  values: MockDraftSetupValues,
  extra: { season: string; userId: string; leagueName: string }
): SimDraftConfig {
  return createDefaultSimDraftConfig({
    draftId: `sim-${values.seed}`,
    userId: extra.userId,
    season: extra.season,
    leagueName: extra.leagueName,
    teams: values.teams,
    userSlot: Math.min(values.userSlot, values.teams),
    pickTimerSeconds: values.pickTimerSeconds,
    scoringRules: mockDraftSetupToScoringRules(values),
    keeperPolicy: {
      startsInSeason: values.keeperStartsInSeason,
      maxPerTeam: values.keeperMaxPerTeam,
      eligibility: values.keeperEligibility,
      cost: values.keeperCost,
      customRoundPenalty:
        values.keeperCost === "custom-round-penalty"
          ? values.keeperCustomRoundPenalty
          : null,
    },
    draftType: values.draftType,
    seed: values.seed,
    botStrategy: values.botStrategy,
    rosterSlots: mockDraftSetupToRosterSlots(values),
  });
}

export function mockDraftSettingsFromLeague(league: SleeperLeague) {
  const teams =
    league.total_rosters ??
    readNumber(league.settings, "num_teams") ??
    defaultMockDraftSetup.teams;
  const rosterSlots = rosterSlotsFromSleeperLeague(league);
  const scoringRules = scoringRulesFromSleeperLeague(league);
  const draft = leagueDraftDetails({ league, teams, rosterSlots });
  return {
    teams,
    rosterSlots,
    scoringRules,
    notices: getUnsupportedDraftFormatNotices(draft, league),
  };
}

function leagueDraftDetails(input: {
  league: SleeperLeague;
  teams: number;
  rosterSlots: DraftRosterSlots;
}): DraftDetails {
  return {
    draft_id: `league-${input.league.league_id}`,
    league_id: input.league.league_id,
    type: "snake",
    season: input.league.season,
    metadata: { name: input.league.name },
    settings: {
      teams: input.teams,
      rounds: calculateDraftRounds(input.rosterSlots),
      slots_qb: input.rosterSlots.QB,
      slots_rb: input.rosterSlots.RB,
      slots_wr: input.rosterSlots.WR,
      slots_te: input.rosterSlots.TE,
      slots_k: input.rosterSlots.K,
      slots_def: input.rosterSlots.DEF,
      slots_flex: input.rosterSlots.FLEX,
      slots_bn: input.rosterSlots.BENCH,
      slots_ir: input.rosterSlots.IR,
    },
    scoring_settings: numericScoringSettings(input.league.scoring_settings),
    slot_to_roster_id: {},
    draft_order: {},
  };
}

function numericScoringSettings(
  scoring: Record<string, unknown> | undefined
) {
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(scoring ?? {})) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) values[key] = numeric;
  }
  return values;
}

function readNumber(
  record: Record<string, unknown> | undefined,
  key: string
) {
  const value = record?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}
