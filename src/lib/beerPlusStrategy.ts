import { z } from "zod";

import type { DraftScoringRules } from "@/lib/draftLeagueConfig";
import type { DraftRosterSlots } from "@/lib/draftLeagueConfig";
import { PositionEnum, type Position } from "@/lib/schemas";

const optionalProjectionStat = z.number().finite().optional();

export const DraftProjectionStatsSchema = z.object({
  pass_yd: optionalProjectionStat,
  pass_td: optionalProjectionStat,
  pass_int: optionalProjectionStat,
  pass_2pt: optionalProjectionStat,
  rush_yd: optionalProjectionStat,
  rush_td: optionalProjectionStat,
  rush_2pt: optionalProjectionStat,
  rec: optionalProjectionStat,
  rec_yd: optionalProjectionStat,
  rec_td: optionalProjectionStat,
  rec_2pt: optionalProjectionStat,
  fum_lost: optionalProjectionStat,
  idp_int: optionalProjectionStat,
  idp_fum_rec: optionalProjectionStat,
  fgm_0_19: optionalProjectionStat,
  fgm_20_29: optionalProjectionStat,
  fgm_30_39: optionalProjectionStat,
  fgm_40_49: optionalProjectionStat,
  fgm_50p: optionalProjectionStat,
  fgmiss: optionalProjectionStat,
  xpm: optionalProjectionStat,
  xpmiss: optionalProjectionStat,
  pts_std: optionalProjectionStat,
  pts_half_ppr: optionalProjectionStat,
  pts_ppr: optionalProjectionStat,
});

export type DraftProjectionStats = z.infer<typeof DraftProjectionStatsSchema>;

export const DraftProjectionInputSchema = z.object({
  playerId: z.string().min(1),
  position: PositionEnum,
  stats: DraftProjectionStatsSchema,
  lastModified: z.number().int().positive().nullable(),
  newsUpdated: z.number().int().positive().nullable(),
});

export type DraftProjectionInput = z.infer<typeof DraftProjectionInputSchema>;

export const DraftProjectionArtifactSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("Sleeper season projections"),
  season: z.string().min(4),
  fetchedAt: z.string().datetime(),
  sourceLastModified: z.string().datetime().nullable(),
  players: z.record(z.string(), DraftProjectionInputSchema),
});

export type DraftProjectionArtifact = z.infer<typeof DraftProjectionArtifactSchema>;

export type StarterAwareValue = {
  rawProjectedPoints: number;
  projectedPoints: number;
  volsBaseline: number;
  manGamesBaseline: number;
  volsValue: number;
  manGamesValue: number;
  value: number;
  volsWeight: number;
};

export type StarterAwareValueResult = {
  valuesByPlayerId: Record<string, StarterAwareValue>;
  relevantPlayerCounts: Record<Position, { vols: number; manGames: number }>;
  flexAllocation: Record<"RB" | "WR" | "TE", number>;
};

export type StarterAwareStrategyStatus = {
  available: boolean;
  reason: string | null;
  source: string;
  sourceLastModified: string | null;
  playerCoveragePct: number;
  requiredStatCoveragePct: number;
  missingPositions: Position[];
  capabilityLimitations: StarterAwareCapabilityLimitation[];
};

export type StarterAwareCapabilityLimitation = {
  code: "UNSUPPORTED_SCORING_RULE" | "MISSING_PROJECTION_FIELD";
  scoringKey: keyof DraftScoringRules;
  position: Position | null;
  message: string;
};

export type SleeperProjectionReconciliation = {
  supportedPoints: number;
  sleeperStandardPoints: number | null;
  difference: number | null;
  status: "within-tolerance" | "named-unsupported" | "unexplained" | "unavailable";
  causes: string[];
};

type ScoringProjectionRequirement = {
  scoringKey: keyof DraftScoringRules;
  projectionField: keyof DraftProjectionStats;
};

const OFFENSIVE_SCORING_REQUIREMENTS = [
  { scoringKey: "reception", projectionField: "rec" },
  { scoringKey: "rushingYard", projectionField: "rush_yd" },
  { scoringKey: "receivingYard", projectionField: "rec_yd" },
  { scoringKey: "rushingTouchdown", projectionField: "rush_td" },
  { scoringKey: "receivingTouchdown", projectionField: "rec_td" },
  { scoringKey: "passingYard", projectionField: "pass_yd" },
  { scoringKey: "passingTouchdown", projectionField: "pass_td" },
  { scoringKey: "interception", projectionField: "pass_int" },
  { scoringKey: "lostFumble", projectionField: "fum_lost" },
] as const satisfies readonly ScoringProjectionRequirement[];

export const STARTER_AWARE_SCORING_CAPABILITY = {
  version: "2026-sleeper-1",
  requiredFields: {
    QB: OFFENSIVE_SCORING_REQUIREMENTS,
    RB: OFFENSIVE_SCORING_REQUIREMENTS,
    WR: OFFENSIVE_SCORING_REQUIREMENTS,
    TE: OFFENSIVE_SCORING_REQUIREMENTS,
    K: [{ scoringKey: "fieldGoalUnder50", projectionField: "pts_std" }],
  },
  providerOmittedZeroFields: [
    "fum_lost",
    "secondary-position statistics only when Sleeper point totals reconcile",
    "standard-scoring fields only when the row total reconciles",
  ],
  defenseMode: "Sleeper standard projected points",
  unsupportedLeagueRules: ["points per carry", "two-point conversions"],
  unavailablePositions: {
    K: "Custom kicker scoring needs field-goal distance splits that Sleeper does not supply.",
  },
} as const satisfies {
  version: string;
  requiredFields: Record<
    "QB" | "RB" | "WR" | "TE" | "K",
    readonly ScoringProjectionRequirement[]
  >;
  providerOmittedZeroFields: readonly string[];
  defenseMode: string;
  unsupportedLeagueRules: readonly string[];
  unavailablePositions: { K: string };
};

// These availability assumptions are explicit because the current proprietary
// BEER inputs are not public. Re-test them before each draft season.
export const MAN_GAMES_ASSUMPTIONS = {
  version: "2026-starter-aware-1",
  seasonGames: 17,
  expectedGames: {
    QB: 15,
    RB: 13,
    WR: 14,
    TE: 14,
    K: 16,
    DEF: 17,
  },
} as const satisfies {
  version: string;
  seasonGames: number;
  expectedGames: Record<Position, number>;
};

type ProjectedPointsInput = {
  position: Position;
  scoringRules: DraftScoringRules;
  stats: DraftProjectionStats;
};

const SLEEPER_STANDARD_SCORING_RULES = {
  reception: 0,
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

function stat(stats: DraftProjectionStats, key: keyof DraftProjectionStats) {
  return stats[key] ?? 0;
}

export function calculateBeerPlusProjectedPoints({
  position,
  scoringRules,
  stats: unparsedStats,
}: ProjectedPointsInput) {
  const stats = DraftProjectionStatsSchema.parse(unparsedStats);

  if (position === "DEF") return stat(stats, "pts_std");

  if (position === "K") {
    if (usesSleeperStandardKickerScoring(scoringRules) && stats.pts_std != null) {
      return stats.pts_std;
    }
    const fieldGoalsUnder50 =
      stat(stats, "fgm_0_19") +
      stat(stats, "fgm_20_29") +
      stat(stats, "fgm_30_39") +
      stat(stats, "fgm_40_49");
    return (
      fieldGoalsUnder50 * scoringRules.fieldGoalUnder50 +
      stat(stats, "fgm_50p") * scoringRules.fieldGoal50Plus +
      stat(stats, "xpm") * scoringRules.extraPoint +
      stat(stats, "fgmiss") * scoringRules.missedFieldGoal +
      stat(stats, "xpmiss") * scoringRules.missedExtraPoint
    );
  }

  return (
    stat(stats, "rec") * scoringRules.reception +
    stat(stats, "rush_yd") * scoringRules.rushingYard +
    stat(stats, "rec_yd") * scoringRules.receivingYard +
    stat(stats, "rush_td") * scoringRules.rushingTouchdown +
    stat(stats, "rec_td") * scoringRules.receivingTouchdown +
    stat(stats, "pass_yd") * scoringRules.passingYard +
    stat(stats, "pass_td") * scoringRules.passingTouchdown +
    stat(stats, "pass_int") * scoringRules.interception +
    stat(stats, "fum_lost") * scoringRules.lostFumble
  );
}

export function reconcileSleeperStandardProjection(input: {
  position: Position;
  stats: DraftProjectionStats;
  tolerance?: number;
}): SleeperProjectionReconciliation {
  const supportedPoints = calculateBeerPlusProjectedPoints({
    position: input.position,
    scoringRules: SLEEPER_STANDARD_SCORING_RULES,
    stats: input.stats,
  });
  const sleeperStandardPoints = input.stats.pts_std ?? null;
  if (sleeperStandardPoints == null) {
    return {
      supportedPoints,
      sleeperStandardPoints,
      difference: null,
      status: "unavailable",
      causes: ["Sleeper standard projected points are missing."],
    };
  }
  const difference = Number((sleeperStandardPoints - supportedPoints).toFixed(2));
  const tolerance = input.tolerance ?? 0.11;
  if (Math.abs(difference) <= tolerance) {
    return {
      supportedPoints,
      sleeperStandardPoints,
      difference,
      status: "within-tolerance",
      causes: [],
    };
  }
  const twoPointValue = 2 * (
    stat(input.stats, "pass_2pt") +
    stat(input.stats, "rush_2pt") +
    stat(input.stats, "rec_2pt")
  );
  const hybridIdpValue = 2 * (
    stat(input.stats, "idp_int") + stat(input.stats, "idp_fum_rec")
  );
  const namedUnsupportedPoints = twoPointValue + hybridIdpValue;
  if (
    namedUnsupportedPoints !== 0 &&
    Math.abs(difference - namedUnsupportedPoints) <= tolerance
  ) {
    const causes: string[] = [];
    if (twoPointValue !== 0) causes.push("two-point conversions");
    if (hybridIdpValue !== 0) causes.push("hybrid IDP statistics");
    return {
      supportedPoints,
      sleeperStandardPoints,
      difference,
      status: "named-unsupported",
      causes,
    };
  }
  return {
    supportedPoints,
    sleeperStandardPoints,
    difference,
    status: "unexplained",
    causes: [],
  };
}

export function buildStarterAwareValues(input: {
  teams: number;
  rosterSlots: DraftRosterSlots;
  players: readonly {
    playerId: string;
    position: Position;
    projectedPoints: number;
    rawProjectedPoints?: number;
  }[];
}): StarterAwareValueResult {
  const sortedByPosition = new Map<Position, typeof input.players>();
  for (const position of PositionEnum.options) {
    sortedByPosition.set(
      position,
      input.players
        .filter((player) => player.position === position)
        .sort((left, right) => right.projectedPoints - left.projectedPoints)
    );
  }

  const directCounts: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
  for (const position of PositionEnum.options) {
    directCounts[position] = input.teams * input.rosterSlots[position];
  }
  const flexAllocation = { RB: 0, WR: 0, TE: 0 };
  const flexCandidates = (["RB", "WR", "TE"] as const)
    .flatMap((position) =>
      (sortedByPosition.get(position) ?? []).slice(directCounts[position])
    )
    .sort((left, right) => right.projectedPoints - left.projectedPoints)
    .slice(0, input.teams * input.rosterSlots.FLEX);
  for (const player of flexCandidates) {
    if (
      player.position === "RB" ||
      player.position === "WR" ||
      player.position === "TE"
    ) {
      flexAllocation[player.position] += 1;
    }
  }

  const relevantPlayerCounts: Record<
    Position,
    { vols: number; manGames: number }
  > = {
    QB: { vols: 0, manGames: 0 },
    RB: { vols: 0, manGames: 0 },
    WR: { vols: 0, manGames: 0 },
    TE: { vols: 0, manGames: 0 },
    K: { vols: 0, manGames: 0 },
    DEF: { vols: 0, manGames: 0 },
  };
  for (const position of PositionEnum.options) {
    const flexCount =
      position === "RB" || position === "WR" || position === "TE"
        ? flexAllocation[position]
        : 0;
    const vols = directCounts[position] + flexCount;
    relevantPlayerCounts[position] = {
      vols,
      manGames: Math.ceil(
        (vols * MAN_GAMES_ASSUMPTIONS.seasonGames) /
          MAN_GAMES_ASSUMPTIONS.expectedGames[position]
      ),
    };
  }

  const valuesByPlayerId: Record<string, StarterAwareValue> = {};
  for (const position of PositionEnum.options) {
    const positionPlayers = sortedByPosition.get(position) ?? [];
    const counts = relevantPlayerCounts[position];
    const volsBaseline = baselineAt(positionPlayers, counts.vols);
    const manGamesBaseline = baselineAt(positionPlayers, counts.manGames);
    const volsWeight =
      counts.vols === 0 ? 0 : counts.vols / (counts.vols + counts.manGames);
    for (const player of positionPlayers) {
      const volsValue = player.projectedPoints - volsBaseline;
      const manGamesValue = player.projectedPoints - manGamesBaseline;
      valuesByPlayerId[player.playerId] = {
        rawProjectedPoints: player.rawProjectedPoints ?? player.projectedPoints,
        projectedPoints: player.projectedPoints,
        volsBaseline,
        manGamesBaseline,
        volsValue,
        manGamesValue,
        value: volsWeight * volsValue + (1 - volsWeight) * manGamesValue,
        volsWeight,
      };
    }
  }

  return { valuesByPlayerId, relevantPlayerCounts, flexAllocation };
}

function baselineAt(
  players: readonly { projectedPoints: number }[],
  relevantPlayerCount: number
) {
  if (relevantPlayerCount <= 0 || players.length === 0) return 0;
  return players[Math.min(relevantPlayerCount, players.length) - 1]?.projectedPoints ?? 0;
}

export function buildStarterAwareStrategy(input: {
  artifact: DraftProjectionArtifact | null;
  players: readonly {
    playerId: string;
    position: Position;
    ecr: number | null;
  }[];
  teams: number;
  rounds: number;
  rosterSlots: DraftRosterSlots;
  scoringRules: DraftScoringRules;
}) {
  const relevant = input.players
    .filter((player) => player.ecr != null)
    .sort((left, right) => (left.ecr ?? Infinity) - (right.ecr ?? Infinity))
    .slice(0, input.teams * input.rounds + input.teams * 3);
  const artifact = input.artifact;
  const requiredPositions = PositionEnum.options.filter(
    (position) => input.rosterSlots[position] > 0 ||
      ((position === "RB" || position === "WR" || position === "TE") &&
        input.rosterSlots.FLEX > 0)
  );
  const leagueCapabilityLimitations = getStarterAwareCapabilityLimitations({
    scoringRules: input.scoringRules,
    rosterSlots: input.rosterSlots,
  });
  const capabilityLimitations = leagueCapabilityLimitations;
  const projected = artifact
    ? input.players.flatMap((player) => {
        const projection = artifact.players[player.playerId];
        if (
          player.ecr == null ||
          !projection ||
          !hasRequiredStats(projection, input.scoringRules)
        ) {
          return [];
        }
        const rawProjectedPoints = calculateBeerPlusProjectedPoints({
          position: player.position,
          scoringRules: input.scoringRules,
          stats: projection.stats,
        });
        return [{
          playerId: player.playerId,
          position: player.position,
          ecr: player.ecr,
          rawProjectedPoints,
          projectedPoints: rawProjectedPoints,
        }];
      })
    : [];
  const calibrated = calibratePositionProjectionCurves(projected);
  const projectedIds = new Set(projected.map((player) => player.playerId));
  const withAnyProjection = artifact
    ? relevant.filter((player) => artifact.players[player.playerId]).length
    : 0;
  const playerCoveragePct = percent(withAnyProjection, relevant.length);
  const requiredStatCoveragePct = percent(
    relevant.filter((player) => projectedIds.has(player.playerId)).length,
    relevant.length
  );
  const missingPositions = requiredPositions.filter(
    (position) => !projected.some((player) => player.position === position)
  );
  const reason = !artifact
    ? "Sleeper season projections are not available."
    : capabilityLimitations.length > 0
      ? capabilityLimitations.map((limitation) => limitation.message).join(" ")
      : missingPositions.length > 0
        ? `Projection data is missing: ${missingPositions.join(", ")}.`
        : null;
  const status: StarterAwareStrategyStatus = {
    available: reason == null,
    reason,
    source: artifact?.source ?? "Sleeper season projections",
    sourceLastModified: artifact?.sourceLastModified ?? null,
    playerCoveragePct,
    requiredStatCoveragePct,
    missingPositions,
    capabilityLimitations,
  };

  return {
    status,
    result: reason == null
      ? buildStarterAwareValues({
          teams: input.teams,
          rosterSlots: input.rosterSlots,
          players: calibrated,
        })
      : null,
  };
}

export function getStarterAwareCapabilityLimitations(input: {
  scoringRules: DraftScoringRules;
  rosterSlots: DraftRosterSlots;
}): StarterAwareCapabilityLimitation[] {
  const limitations: StarterAwareCapabilityLimitation[] = [];
  if (input.scoringRules.pointsPerCarry !== 0) {
    limitations.push({
      code: "UNSUPPORTED_SCORING_RULE",
      scoringKey: "pointsPerCarry",
      position: null,
      message: "Starter-aware value does not support points per carry.",
    });
  }
  if (
    input.rosterSlots.DEF > 0 &&
    input.scoringRules.defense === "unsupported-custom"
  ) {
    limitations.push({
      code: "UNSUPPORTED_SCORING_RULE",
      scoringKey: "defense",
      position: "DEF",
      message:
        "Starter-aware value supports D/ST only with standard Sleeper scoring.",
    });
  }
  if (
    input.rosterSlots.K > 0 &&
    !usesSleeperStandardKickerScoring(input.scoringRules)
  ) {
    limitations.push({
      code: "UNSUPPORTED_SCORING_RULE",
      scoringKey: "fieldGoalUnder50",
      position: "K",
      message:
        "Starter-aware value supports kickers only with standard Sleeper scoring because field-goal distance splits are not available.",
    });
  }
  return limitations;
}

function calibratePositionProjectionCurves(
  players: readonly {
    playerId: string;
    position: Position;
    ecr: number;
    rawProjectedPoints: number;
    projectedPoints: number;
  }[]
) {
  return PositionEnum.options.flatMap((position) => {
    const atPosition = players.filter((player) => player.position === position);
    const pointCurve = atPosition
      .map((player) => player.rawProjectedPoints)
      .sort((left, right) => right - left);
    return [...atPosition]
      .sort((left, right) => left.ecr - right.ecr || left.playerId.localeCompare(right.playerId))
      .map((player, index) => ({
        ...player,
        projectedPoints: pointCurve[index] ?? player.rawProjectedPoints,
      }));
  });
}

function hasRequiredStats(
  projection: DraftProjectionInput,
  scoringRules: DraftScoringRules
) {
  const stats = projection.stats;
  if (
    projection.position === "QB" ||
    projection.position === "RB" ||
    projection.position === "WR" ||
    projection.position === "TE"
  ) {
    return STARTER_AWARE_SCORING_CAPABILITY.requiredFields[
      projection.position
    ].every((requirement) =>
      projectionFieldIsAvailable(projection, requirement, scoringRules)
    );
  }
  if (projection.position === "K") return stats.pts_std != null;
  return stats.pts_std != null;
}

function usesSleeperStandardKickerScoring(scoringRules: DraftScoringRules) {
  return (
    scoringRules.fieldGoalUnder50 === SLEEPER_STANDARD_SCORING_RULES.fieldGoalUnder50 &&
    scoringRules.fieldGoal50Plus === SLEEPER_STANDARD_SCORING_RULES.fieldGoal50Plus &&
    scoringRules.extraPoint === SLEEPER_STANDARD_SCORING_RULES.extraPoint &&
    scoringRules.missedFieldGoal === SLEEPER_STANDARD_SCORING_RULES.missedFieldGoal &&
    scoringRules.missedExtraPoint === SLEEPER_STANDARD_SCORING_RULES.missedExtraPoint
  );
}

function projectionFieldIsAvailable(
  projection: DraftProjectionInput,
  requirement: ScoringProjectionRequirement,
  scoringRules: DraftScoringRules
) {
  if (scoringRules[requirement.scoringKey] === 0) return true;
  if (projection.stats[requirement.projectionField] != null) return true;
  if (projection.position === "K") return false;
  if (SLEEPER_STANDARD_SCORING_RULES[requirement.scoringKey] === 0) {
    return requirement.scoringKey === "reception" &&
      missingReceptionIsConfirmedZero(projection.stats);
  }
  const reconciliation = reconcileSleeperStandardProjection({
    position: projection.position,
    stats: projection.stats,
  });
  return reconciliation.status === "within-tolerance" ||
    reconciliation.status === "named-unsupported";
}

function missingReceptionIsConfirmedZero(stats: DraftProjectionStats) {
  if (stats.pts_std == null || stats.pts_ppr == null) return false;
  return Math.abs(stats.pts_ppr - stats.pts_std) <= 0.11;
}

function percent(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(1));
}
