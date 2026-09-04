import { z } from "zod";

import {
  buildStarterAwareStrategy,
  type DraftProjectionArtifact,
} from "@/lib/beerPlusStrategy";
import type { DraftCandidate } from "@/lib/draftCandidate";
import type {
  DraftRosterSlots,
  DraftScoringRules,
} from "@/lib/draftLeagueConfig";
import { PositionEnum, scoringTypeSchema, type Position } from "@/lib/schemas";
import type {
  AggregateSourceHealthT,
  AggregatesBundleResponseT,
} from "@/lib/schemas-bundle";
import { normalizePlayerName } from "@/lib/util";

const FETCH_MAX_AGE_HOURS = 18;
const PROVIDER_MAX_AGE_HOURS = 48;
const MIN_EXPERTS = 50;
const MIN_EXPERT_COVERAGE_PCT = 50;
const CORE_PLAYER_COUNT = 120;
const RESERVE_ROUNDS = 3;

const DraftReadinessIncidentSchema = z.object({
  code: z.string().min(1),
  scope: z.enum(["pipeline", "FantasyPros", "Sleeper", "derived", "cohort"]),
  message: z.string().min(1),
});

const DraftReadinessPlayerIssueSchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  position: PositionEnum,
  cohorts: z.array(z.enum(["core", "expected", "reserve"])).min(1),
  problems: z.array(z.string().min(1)).min(1),
  previouslyReadyAt: z.string().datetime().nullable(),
});

const DraftReadinessCohortSchema = z.object({
  id: z.enum(["core", "expected", "reserve"]),
  label: z.string().min(1),
  rankDepth: z.number().int().positive(),
  requiredCoveragePct: z.number().min(0).max(100),
  playerIds: z.array(z.string().min(1)),
  total: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  coveragePct: z.number().min(0).max(100),
  status: z.enum(["ready", "warning", "incident"]),
});

const DraftReadinessProviderSchema = z.object({
  status: z.enum(["ready", "incident"]),
  season: z.string().nullable(),
  fetchedAt: z.string().datetime().nullable(),
  lastUpdatedAt: z.string().datetime().nullable(),
  fetchAgeHours: z.number().nonnegative().nullable(),
  providerAgeHours: z.number().nonnegative().nullable(),
  expertsIncluded: z.number().int().nonnegative().nullable(),
  expertsAvailable: z.number().int().nonnegative().nullable(),
  expertCoveragePct: z.number().nonnegative().nullable(),
});

const ShardCountsSchema = z.object({
  ALL: z.number().int().nonnegative(),
  QB: z.number().int().nonnegative(),
  RB: z.number().int().nonnegative(),
  WR: z.number().int().nonnegative(),
  TE: z.number().int().nonnegative(),
  K: z.number().int().nonnegative(),
  DEF: z.number().int().nonnegative(),
  FLEX: z.number().int().nonnegative(),
});

export const DraftReadinessReportSchema = z.object({
  version: z.literal(3),
  status: z.enum(["ready", "incident"]),
  checkedAt: z.string().datetime(),
  mode: z.string().min(1),
  season: z.string().min(1),
  league: z.object({
    teams: z.number().int().min(2),
    rounds: z.number().int().positive(),
    scoring: scoringTypeSchema,
  }),
  providers: z.object({
    fantasyPros: DraftReadinessProviderSchema,
    sleeper: DraftReadinessProviderSchema,
  }),
  shards: ShardCountsSchema,
  cohorts: z.object({
    core: DraftReadinessCohortSchema,
    expected: DraftReadinessCohortSchema,
    reserve: DraftReadinessCohortSchema,
  }),
  playerIssues: z.array(DraftReadinessPlayerIssueSchema),
  incidents: z.array(DraftReadinessIncidentSchema),
});

export type DraftReadinessReport = z.infer<typeof DraftReadinessReportSchema>;
export type DraftReadinessShardCounts = z.infer<typeof ShardCountsSchema>;

type CohortId = keyof DraftReadinessReport["cohorts"];
type Strategy = ReturnType<typeof buildStarterAwareStrategy>;

export type DraftReadinessAssessment = {
  report: DraftReadinessReport;
  strategy: Strategy;
};

export function isDraftReadinessReportCurrent(
  report: DraftReadinessReport,
  now: Date = new Date()
) {
  const checkedAt = Date.parse(report.checkedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > now.getTime()) return false;
  const providersAreCurrent = Object.values(report.providers).every(
    (provider) => {
      const fetchAge = ageHours(provider.fetchedAt, now);
      const providerAge = ageHours(provider.lastUpdatedAt, now);
      return (
        fetchAge != null &&
        fetchAge <= FETCH_MAX_AGE_HOURS &&
        providerAge != null &&
        providerAge <= PROVIDER_MAX_AGE_HOURS
      );
    }
  );
  return (
    report.status === "ready" &&
    providersAreCurrent &&
    now.getTime() - checkedAt <= FETCH_MAX_AGE_HOURS * 3_600_000
  );
}

export function draftReadinessShardCountsFromBundle(
  bundle: Pick<AggregatesBundleResponseT, "shards">
): DraftReadinessShardCounts {
  return ShardCountsSchema.parse(
    Object.fromEntries(
      Object.entries(bundle.shards).map(([position, players]) => [
        position,
        players.length,
      ])
    )
  );
}

export function assessDraftReadiness(input: {
  candidates: readonly DraftCandidate[];
  sourceHealth: AggregateSourceHealthT | null;
  projectionArtifact: DraftProjectionArtifact | null;
  teams: number;
  rounds: number;
  scoring: z.infer<typeof scoringTypeSchema>;
  scoringRules: DraftScoringRules;
  rosterSlots: DraftRosterSlots;
  mode: string;
  season: string;
  shardCounts: DraftReadinessShardCounts;
  previous?: DraftReadinessReport | null;
  requireAllShards?: boolean;
  now?: Date;
}): DraftReadinessAssessment {
  const now = input.now ?? new Date();
  const incidents: DraftReadinessReport["incidents"] = [];
  const strategy = buildStarterAwareStrategy({
    artifact: input.projectionArtifact,
    players: input.candidates.map((player) => ({
      playerId: player.player_id,
      position: player.position,
      ecr: player.fp_rank_ave,
    })),
    teams: input.teams,
    rounds: input.rounds,
    rosterSlots: input.rosterSlots,
    scoringRules: input.scoringRules,
  });

  if (input.mode !== "draft") {
    incidents.push({
      code: "WRONG_PIPELINE_MODE",
      scope: "pipeline",
      message: `Pipeline mode is ${input.mode}; expected draft.`,
    });
  }
  if (input.projectionArtifact?.season !== input.season) {
    incidents.push({
      code: "WRONG_SEASON",
      scope: "pipeline",
      message:
        `Sleeper projection season is ${input.projectionArtifact?.season ?? "missing"}; ` +
        `expected ${input.season}.`,
    });
  }
  const requiredShards = input.requireAllShards
    ? (Object.keys(input.shardCounts) as Array<keyof DraftReadinessShardCounts>)
    : requiredShardNames(input.rosterSlots);
  for (const position of requiredShards) {
    const count = input.shardCounts[position];
    if (count === 0) {
      incidents.push({
        code: "EMPTY_SHARD",
        scope: "derived",
        message: `${position} aggregate shard is empty.`,
      });
    }
  }

  const fantasyPros = providerReport({
    source: "FantasyPros",
    sourceHealth: input.sourceHealth,
    now,
    expectedSeason: input.season,
    incidents,
  });
  const sleeper = providerReport({
    source: "Sleeper",
    sourceHealth: input.sourceHealth,
    now,
    expectedSeason: input.season,
    incidents,
  });
  if (
    fantasyPros.expertsIncluded == null ||
    fantasyPros.expertsIncluded < MIN_EXPERTS
  ) {
    incidents.push({
      code: "THIN_EXPERT_SAMPLE",
      scope: "FantasyPros",
      message:
        `FantasyPros has ${fantasyPros.expertsIncluded ?? 0} included experts; ` +
        `${MIN_EXPERTS} are required.`,
    });
  }
  if (
    fantasyPros.expertCoveragePct == null ||
    fantasyPros.expertCoveragePct < MIN_EXPERT_COVERAGE_PCT
  ) {
    incidents.push({
      code: "LOW_EXPERT_COVERAGE",
      scope: "FantasyPros",
      message:
        `FantasyPros expert coverage is ${fantasyPros.expertCoveragePct ?? 0}%; ` +
        `${MIN_EXPERT_COVERAGE_PCT}% is required.`,
    });
  }
  if (!strategy.status.available) {
    incidents.push({
      code: "VALUE_MODEL_UNAVAILABLE",
      scope: "derived",
      message: strategy.status.reason ?? "The draft value model is unavailable.",
    });
  }

  const draftCapacity = input.teams * input.rounds;
  const coreDepth = Math.min(CORE_PLAYER_COUNT, draftCapacity);
  const reserveDepth = draftCapacity + input.teams * RESERVE_ROUNDS;
  const cohortCandidates = withIndependentSourcePlayers(
    input.candidates,
    input.sourceHealth
  );
  const draftableCandidates = cohortCandidates.filter((player) =>
    positionIsDraftable(player.position, input.rosterSlots)
  );
  const coreIds = rankedUnion(draftableCandidates, coreDepth);
  const expectedIds = addRequiredSpecialists(
    rankedUnion(draftableCandidates, draftCapacity),
    draftableCandidates,
    input.teams,
    input.rosterSlots
  );
  const reserveIds = rankedUnion(draftableCandidates, reserveDepth).filter(
    (playerId) => !expectedIds.includes(playerId)
  );
  const cohortIds = { core: coreIds, expected: expectedIds, reserve: reserveIds };
  const playerById = new Map(
    cohortCandidates.map((candidate) => [candidate.player_id, candidate])
  );
  const issuesByPlayerId = new Map<string, string[]>();
  const sourceMarketKeys = new Set(
    (input.sourceHealth?.sleeperPlayers ?? []).map((player) =>
      sourcePlayerKey(player.normalizedName, player.position)
    )
  );
  for (const playerId of new Set(Object.values(cohortIds).flat())) {
    const player = playerById.get(playerId);
    if (!player) continue;
    const problems = candidateProblems(
      player,
      input.projectionArtifact,
      strategy,
      sourceMarketKeys.has(sourcePlayerKey(player.name, player.position)),
      now
    );
    if (problems.length > 0) issuesByPlayerId.set(playerId, problems);
  }

  const previousReadyAtByPlayerId = previousReadyPlayers(input.previous);
  const playerIssues = [...issuesByPlayerId].map(([playerId, problems]) => {
    const player = playerById.get(playerId);
    if (!player) throw new Error(`Readiness candidate ${playerId} is missing.`);
    const cohorts = (Object.keys(cohortIds) as CohortId[]).filter((cohort) =>
      cohortIds[cohort].includes(playerId)
    );
    return {
      playerId,
      name: player.name,
      position: player.position,
      cohorts,
      problems,
      previouslyReadyAt: previousReadyAtByPlayerId.get(playerId) ?? null,
    };
  });

  const cohorts = {
    core: cohortReport("core", "Core", coreDepth, 100, coreIds, issuesByPlayerId),
    expected: cohortReport(
      "expected",
      "Expected draft pool",
      draftCapacity,
      100,
      expectedIds,
      issuesByPlayerId
    ),
    reserve: cohortReport(
      "reserve",
      "Reserve pool",
      reserveDepth,
      95,
      reserveIds,
      issuesByPlayerId,
      "warning"
    ),
  };
  for (const cohort of Object.values(cohorts)) {
    if (cohort.status === "incident") {
      incidents.push({
        code: "COHORT_COVERAGE",
        scope: "cohort",
        message:
          `${cohort.label} is ${cohort.ready}/${cohort.total} ready ` +
          `(${cohort.coveragePct}%); ${cohort.requiredCoveragePct}% is required.`,
      });
    }
  }

  const report = DraftReadinessReportSchema.parse({
    version: 3,
    status: incidents.length === 0 ? "ready" : "incident",
    checkedAt: now.toISOString(),
    mode: input.mode,
    season: input.season,
    league: {
      teams: input.teams,
      rounds: input.rounds,
      scoring: input.scoring,
    },
    providers: {
      fantasyPros: {
        ...fantasyPros,
        status: incidents.some((incident) => incident.scope === "FantasyPros")
          ? "incident"
          : "ready",
      },
      sleeper: {
        ...sleeper,
        status: incidents.some((incident) => incident.scope === "Sleeper")
          ? "incident"
          : "ready",
      },
    },
    shards: input.shardCounts,
    cohorts,
    playerIssues,
    incidents,
  });
  return { report, strategy };
}

function providerReport(input: {
  source: "Sleeper" | "FantasyPros";
  sourceHealth: AggregateSourceHealthT | null;
  now: Date;
  expectedSeason: string;
  incidents: DraftReadinessReport["incidents"];
}) {
  const source = input.sourceHealth?.sources.find(
    (candidate) => candidate.source === input.source
  );
  const fetchAgeHours = ageHours(source?.fetchedAt ?? null, input.now);
  const providerAgeHours = ageHours(source?.lastUpdated ?? null, input.now);
  if (!source || source.status === "missing") {
    input.incidents.push({
      code: "SOURCE_MISSING",
      scope: input.source,
      message: source?.problems.join(" ") || `${input.source} data is missing.`,
    });
  }
  if (source?.season !== input.expectedSeason) {
    input.incidents.push({
      code: "WRONG_SOURCE_SEASON",
      scope: input.source,
      message:
        `${input.source} season is ${source?.season ?? "missing"}; ` +
        `expected ${input.expectedSeason}.`,
    });
  }
  if (fetchAgeHours == null || fetchAgeHours > FETCH_MAX_AGE_HOURS) {
    input.incidents.push({
      code: "FETCH_STALE",
      scope: input.source,
      message:
        `${input.source} was last fetched ${formatAge(fetchAgeHours)}; ` +
        `the limit is ${FETCH_MAX_AGE_HOURS} hours.`,
    });
  }
  if (providerAgeHours == null || providerAgeHours > PROVIDER_MAX_AGE_HOURS) {
    input.incidents.push({
      code: "PROVIDER_STALE",
      scope: input.source,
      message:
        `${input.source} was last updated ${formatAge(providerAgeHours)}; ` +
        `the limit is ${PROVIDER_MAX_AGE_HOURS} hours.`,
    });
  }
  return {
    season: source?.season ?? null,
    fetchedAt: source?.fetchedAt ?? null,
    lastUpdatedAt: source?.lastUpdated ?? null,
    fetchAgeHours,
    providerAgeHours,
    expertsIncluded: source?.expertsIncluded ?? null,
    expertsAvailable: source?.expertsAvailable ?? null,
    expertCoveragePct: source?.expertCoveragePct ?? null,
  };
}

function requiredShardNames(rosterSlots: DraftRosterSlots) {
  const required = new Set<keyof DraftReadinessShardCounts>(["ALL"]);
  for (const position of ["QB", "RB", "WR", "TE", "K", "DEF"] as const) {
    if (rosterSlots[position] > 0) required.add(position);
  }
  if (rosterSlots.FLEX > 0) {
    required.add("FLEX");
    required.add("RB");
    required.add("WR");
    required.add("TE");
  }
  return [...required];
}

function withIndependentSourcePlayers(
  candidates: readonly DraftCandidate[],
  sourceHealth: AggregateSourceHealthT | null
) {
  const byKey = new Map(
    candidates.map(
      (candidate) =>
        [sourcePlayerKey(candidate.name, candidate.position), candidate] as const
    )
  );
  for (const player of sourceHealth?.fantasyProsPlayers ?? []) {
    const key = sourcePlayerKey(player.normalizedName, player.position);
    if (byKey.has(key)) continue;
    const updatedAt = player.updatedAt ? Date.parse(player.updatedAt) : NaN;
    byKey.set(key, {
      player_id: `fantasypros:${player.sourcePlayerId}`,
      name: player.name,
      position: player.position,
      team: null,
      bye_week: null,
      rank: null,
      tier: null,
      tier_rank: null,
      tier_level: null,
      position_tier_level: null,
      sleeper_tier_level: null,
      fp_rank_ave: player.rankAve,
      fp_rank_pos: player.rankPos,
      sleeper_adp: null,
      sleeper_board_rank: null,
      sleeper_board_value: null,
      sleeper_injury_status: null,
      sleeper_injury_notes: null,
      sleeper_depth_chart_position: null,
      sleeper_depth_chart_order: null,
      fp_rank_updated_at: Number.isFinite(updatedAt) ? updatedAt : null,
      sleeper_projection: null,
    });
  }
  for (const player of sourceHealth?.sleeperPlayers ?? []) {
    const key = sourcePlayerKey(player.normalizedName, player.position);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        sleeper_board_rank: player.marketRank,
      });
      continue;
    }
    byKey.set(key, {
      player_id: player.playerId,
      name: player.name,
      position: player.position,
      team: null,
      bye_week: null,
      rank: null,
      tier: null,
      tier_rank: null,
      tier_level: null,
      position_tier_level: null,
      sleeper_tier_level: null,
      fp_rank_ave: null,
      fp_rank_pos: null,
      sleeper_adp: null,
      sleeper_board_rank: player.marketRank,
      sleeper_board_value: null,
      sleeper_injury_status: null,
      sleeper_injury_notes: null,
      sleeper_depth_chart_position: null,
      sleeper_depth_chart_order: null,
      fp_rank_updated_at: null,
      sleeper_projection: null,
    });
  }
  return [...byKey.values()];
}

function sourcePlayerKey(name: string, position: Position) {
  return `${normalizePlayerName(name)}:${position}`;
}

function rankedUnion(candidates: readonly DraftCandidate[], depth: number) {
  const byEcr = candidates
    .filter((player) => player.fp_rank_ave != null)
    .toSorted(
      (left, right) =>
        (left.fp_rank_ave ?? Infinity) - (right.fp_rank_ave ?? Infinity)
    )
    .slice(0, depth);
  const bySleeper = candidates
    .filter((player) => marketRank(player) != null)
    .toSorted(
      (left, right) =>
        (marketRank(left) ?? Infinity) - (marketRank(right) ?? Infinity)
    )
    .slice(0, depth);
  return [...new Set([...byEcr, ...bySleeper].map((player) => player.player_id))];
}

function addRequiredSpecialists(
  playerIds: string[],
  candidates: readonly DraftCandidate[],
  teams: number,
  rosterSlots: DraftRosterSlots
) {
  const result = new Set(playerIds);
  for (const position of ["K", "DEF"] as const) {
    const required = teams * rosterSlots[position];
    if (required === 0) continue;
    const specialists = candidates
      .filter((player) => player.position === position)
      .toSorted(
        (left, right) =>
          (left.fp_rank_pos ?? marketRank(left) ?? Infinity) -
          (right.fp_rank_pos ?? marketRank(right) ?? Infinity)
      )
      .slice(0, required);
    for (const specialist of specialists) result.add(specialist.player_id);
  }
  return [...result];
}

function marketRank(player: DraftCandidate) {
  const ranks = [player.sleeper_adp, player.sleeper_board_rank].filter(
    (rank): rank is number =>
      rank != null && Number.isFinite(rank) && rank > 0 && rank < 900
  );
  return ranks.length === 0 ? null : Math.min(...ranks);
}

function positionIsDraftable(
  position: Position,
  rosterSlots: DraftRosterSlots
) {
  if (rosterSlots[position] > 0) return true;
  return (
    rosterSlots.FLEX > 0 &&
    (position === "RB" || position === "WR" || position === "TE")
  );
}

function candidateProblems(
  player: DraftCandidate,
  artifact: DraftProjectionArtifact | null,
  strategy: Strategy,
  sourceMarketExpected: boolean,
  now: Date
) {
  const problems: string[] = [];
  if (player.fp_rank_ave == null) problems.push("FantasyPros ECR is missing.");
  if (player.fp_rank_pos == null) problems.push("FantasyPros position rank is missing.");
  if (player.tier_level == null) problems.push("Overall tier is missing.");
  if (player.position_tier_level == null) problems.push("Position tier is missing.");
  if (sourceMarketExpected && marketRank(player) == null) {
    problems.push("Sleeper draft-market rank was not merged.");
  }
  if (!artifact?.players[player.player_id]) {
    problems.push("Sleeper projection is missing.");
  }
  addPlayerFreshnessProblem(
    problems,
    "FantasyPros ECR",
    player.fp_rank_updated_at,
    now
  );
  addPlayerFreshnessProblem(
    problems,
    "Sleeper projection",
    player.sleeper_projection?.lastModified ?? null,
    now
  );
  const value = strategy.result?.valuesByPlayerId[player.player_id]?.value;
  if (value == null || !Number.isFinite(value)) {
    problems.push("VAL cannot be calculated for the selected scoring.");
  }
  return problems;
}

function addPlayerFreshnessProblem(
  problems: string[],
  label: string,
  timestamp: number | null,
  now: Date
) {
  const age = ageHours(timestamp, now);
  if (age == null) {
    problems.push(`${label} update time is missing or invalid.`);
  } else if (age > PROVIDER_MAX_AGE_HOURS) {
    problems.push(`${label} is stale (${age} hours old).`);
  }
}

function cohortReport(
  id: CohortId,
  label: string,
  rankDepth: number,
  requiredCoveragePct: number,
  playerIds: string[],
  issuesByPlayerId: ReadonlyMap<string, readonly string[]>,
  incompleteStatus: "warning" | "incident" = "incident"
) {
  const total = playerIds.length;
  const ready = playerIds.filter((playerId) => !issuesByPlayerId.has(playerId)).length;
  const coveragePct = percent(ready, total);
  return {
    id,
    label,
    rankDepth,
    requiredCoveragePct,
    playerIds,
    total,
    ready,
    coveragePct,
    status: coveragePct >= requiredCoveragePct ? "ready" : incompleteStatus,
  } as const;
}

function previousReadyPlayers(previous: DraftReadinessReport | null | undefined) {
  const result = new Map<string, string>();
  if (!previous) return result;
  const priorProblemIds = new Set(previous.playerIssues.map((issue) => issue.playerId));
  for (const playerId of Object.values(previous.cohorts).flatMap(
    (cohort) => cohort.playerIds
  )) {
    if (!priorProblemIds.has(playerId)) result.set(playerId, previous.checkedAt);
  }
  return result;
}

function ageHours(value: string | number | null, now: Date) {
  if (value == null) return null;
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now.getTime()) return null;
  return Number(((now.getTime() - timestamp) / 3_600_000).toFixed(1));
}

function formatAge(age: number | null) {
  return age == null ? "at an unknown time" : `${age} hours ago`;
}

function percent(numerator: number, denominator: number) {
  return denominator === 0
    ? 100
    : Number(((numerator / denominator) * 100).toFixed(1));
}
