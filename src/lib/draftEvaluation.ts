import { calculateTeamNeedsAndCountsForSingleTeam } from "@/lib/draftHelpers";
import type { DraftResultArtifact } from "@/lib/draftResults";
import type { Position, RosterSlot } from "@/lib/schemas";
import { getMinimumRbWrDepth } from "@/lib/draftRosterPolicy";
import {
  classifyDraftAvailability,
  type DraftAvailabilityClass,
} from "@/lib/draftAvailability";

export type DraftEvaluationIssueCode =
  | "DRAFT_INCOMPLETE"
  | "UNKNOWN_PLAYER"
  | "DUPLICATE_PLAYER"
  | "UNAVAILABLE_PLAYER"
  | "ROSTER_INCOMPLETE"
  | "QB_COUNT"
  | "TE_COUNT"
  | "K_COUNT"
  | "K_EARLY"
  | "DEF_COUNT"
  | "DEF_EARLY"
  | "RB_DEPTH"
  | "WR_DEPTH"
  | "WR2_LATE"
  | "QB_BELOW_USABLE_FLOOR"
  | "TE_OUTSIDE_TOP_SIX";

export type DraftEvaluationIssue = {
  code: DraftEvaluationIssueCode;
  detail: string;
};

export type DraftQualityEvaluation = {
  positionSequence: string[];
  positionCounts: Record<Position, number>;
  mandatoryPass: boolean;
  rosterComplete: boolean;
  endgamePass: boolean;
  coreConstructionPass: boolean;
  mandatoryIssues: DraftEvaluationIssue[];
  endgameIssues: DraftEvaluationIssue[];
  constructionIssues: DraftEvaluationIssue[];
  diagnosticIssues: DraftEvaluationIssue[];
  qbRound: number | null;
  qbStarterName: string | null;
  qbStarterPosRank: number | null;
  qbUsable: boolean | null;
  qbEcrReachPicks: number | null;
  qbAdpReachPicks: number | null;
  teRound: number | null;
  teStarterName: string | null;
  teStarterPosRank: number | null;
  teTopSix: boolean | null;
  teEcrReachPicks: number | null;
  teAdpReachPicks: number | null;
  rbWrBenchAdpReachPicks: number | null;
  availabilityCounts: Record<DraftAvailabilityClass, number>;
  rankingsMayBeStalePickCount: number;
  rb2Round: number | null;
  wr2Round: number | null;
  kRound: number | null;
  defRound: number | null;
};

export type CoreStarterEcrEvaluation = {
  score: number | null;
  finish: number | null;
};

export function evaluateDraftQuality(
  artifact: DraftResultArtifact
): DraftQualityEvaluation {
  const playersById = new Map(
    artifact.players.all.map((player) => [player.player_id, player])
  );
  const userPicks = artifact.sleeper.picks
    .filter((pick) => pick.draft_slot === artifact.summary.userSlot)
    .sort((left, right) => left.pick_no - right.pick_no);
  const resolvedPicks = userPicks.flatMap((pick) => {
    const player = playersById.get(pick.player_id);
    return player ? [{ pick, player }] : [];
  });
  const positionSequence = userPicks.map(
    (pick) => playersById.get(pick.player_id)?.position ?? "?"
  );
  const positionCounts = zeroPositionCounts();
  const availabilityCounts = zeroAvailabilityCounts();
  let rankingsMayBeStalePickCount = 0;
  for (const { player } of resolvedPicks) {
    positionCounts[player.position] += 1;
  }

  const requirements = rosterRequirements(artifact);
  const { positionNeeds } = calculateTeamNeedsAndCountsForSingleTeam(
    resolvedPicks.map(({ player }) => player),
    requirements
  );
  const mandatoryIssues: DraftEvaluationIssue[] = [];
  for (const { pick, player } of resolvedPicks) {
    const availability = classifyDraftAvailability({
      injuryStatus: player.sleeper_injury_status ?? null,
      injuryNotes: player.sleeper_injury_notes ?? null,
      newsUpdated: player.sleeper_news_updated ?? null,
      rankingsUpdatedAt: player.fp_rank_updated_at ?? null,
      currentRound: pick.round,
      rounds: artifact.summary.rounds,
      irSlots: artifact.state.config.rosterSlots.IR,
    });
    availabilityCounts[availability.classification] += 1;
    if (availability.rankingsMayBeStale) rankingsMayBeStalePickCount += 1;
  }
  if (availabilityCounts.unavailable > 0) {
    mandatoryIssues.push({
      code: "UNAVAILABLE_PLAYER",
      detail: `${availabilityCounts.unavailable} drafted players were confirmed unavailable.`,
    });
  }
  if (
    artifact.summary.status !== "complete" ||
    userPicks.length !== artifact.summary.rounds
  ) {
    mandatoryIssues.push({
      code: "DRAFT_INCOMPLETE",
      detail: `Expected ${artifact.summary.rounds} user picks in a complete draft; found ${userPicks.length}.`,
    });
  }
  const unknownPlayerCount = userPicks.length - resolvedPicks.length;
  if (unknownPlayerCount > 0) {
    mandatoryIssues.push({
      code: "UNKNOWN_PLAYER",
      detail: `${unknownPlayerCount} user picks do not resolve to saved player data.`,
    });
  }
  const duplicateCount = userPicks.length - new Set(userPicks.map((pick) => pick.player_id)).size;
  if (duplicateCount > 0) {
    mandatoryIssues.push({
      code: "DUPLICATE_PLAYER",
      detail: `${duplicateCount} user picks repeat a player ID.`,
    });
  }
  const openSlots = Object.entries(positionNeeds).filter(([, count]) => count > 0);
  if (openSlots.length > 0) {
    mandatoryIssues.push({
      code: "ROSTER_INCOMPLETE",
      detail: `Open roster slots: ${openSlots
        .map(([slot, count]) => `${slot} ${count}`)
        .join(", ")}.`,
    });
  }
  if (positionCounts.QB > 1) {
    mandatoryIssues.push({
      code: "QB_COUNT",
      detail: `Expected no more than 1 QB; drafted ${positionCounts.QB}.`,
    });
  }
  if (positionCounts.TE > 1) {
    mandatoryIssues.push({
      code: "TE_COUNT",
      detail: `Expected no more than 1 TE; drafted ${positionCounts.TE}.`,
    });
  }

  const roundsForPosition = (position: Position) =>
    resolvedPicks
      .filter(({ player }) => player.position === position)
      .map(({ pick }) => pick.round);
  const nthRound = (position: Position, count: number) =>
    roundsForPosition(position)[count - 1] ?? null;
  const starterAt = (position: "QB" | "TE") =>
    resolvedPicks.find(({ player }) => player.position === position) ?? null;
  const qbStarter = starterAt("QB");
  const teStarter = starterAt("TE");
  const qbStarterPosRank = finiteNumber(qbStarter?.player.fp_rank_pos);
  const teStarterPosRank = finiteNumber(teStarter?.player.fp_rank_pos);
  const qbRound = nthRound("QB", 1);
  const teRound = nthRound("TE", 1);
  const qbEcrReachPicks = starterReachPicks(qbStarter, "ecr");
  const qbAdpReachPicks = starterReachPicks(qbStarter, "adp");
  const teEcrReachPicks = starterReachPicks(teStarter, "ecr");
  const teAdpReachPicks = starterReachPicks(teStarter, "adp");
  const rbWrBenchAdpReachPicks = meanRbWrBenchAdpReachPicks(
    resolvedPicks,
    requirements
  );
  const rb2Round = nthRound("RB", 2);
  const wr2Round = nthRound("WR", 2);
  const kRound = nthRound("K", 1);
  const defRound = nthRound("DEF", 1);

  const requiredK = requirements.K;
  const requiredDef = requirements.DEF;
  const endgameStart = Math.max(1, artifact.summary.rounds - 1);
  const endgameIssues: DraftEvaluationIssue[] = [];
  if (positionCounts.K !== requiredK) {
    endgameIssues.push({
      code: "K_COUNT",
      detail: `Expected ${requiredK} K; drafted ${positionCounts.K}.`,
    });
  } else if (requiredK > 0 && (kRound == null || kRound < endgameStart)) {
    endgameIssues.push({
      code: "K_EARLY",
      detail: `K was drafted in round ${kRound ?? "unknown"}; the endgame starts in round ${endgameStart}.`,
    });
  }
  if (positionCounts.DEF !== requiredDef) {
    endgameIssues.push({
      code: "DEF_COUNT",
      detail: `Expected ${requiredDef} D/ST; drafted ${positionCounts.DEF}.`,
    });
  } else if (requiredDef > 0 && (defRound == null || defRound < endgameStart)) {
    endgameIssues.push({
      code: "DEF_EARLY",
      detail: `D/ST was drafted in round ${defRound ?? "unknown"}; the endgame starts in round ${endgameStart}.`,
    });
  }

  const minimumDepth = getMinimumRbWrDepth(requirements);
  const minimumRbDepth = minimumDepth.RB;
  const minimumWrDepth = minimumDepth.WR;
  const constructionIssues: DraftEvaluationIssue[] = [];
  if (positionCounts.RB < minimumRbDepth) {
    constructionIssues.push({
      code: "RB_DEPTH",
      detail: `Expected at least ${minimumRbDepth} RB for this roster shape; drafted ${positionCounts.RB}.`,
    });
  }
  if (positionCounts.WR < minimumWrDepth) {
    constructionIssues.push({
      code: "WR_DEPTH",
      detail: `Expected at least ${minimumWrDepth} WR for this roster shape; drafted ${positionCounts.WR}.`,
    });
  }
  const qbIsEarlyElite =
    qbRound != null &&
    qbRound <= 5 &&
    finiteNumber(qbStarter?.player.position_tier_level) === 1;
  const wr2Deadline = qbIsEarlyElite ? 6 : 5;
  if (requirements.WR >= 2 && (wr2Round == null || wr2Round > wr2Deadline)) {
    constructionIssues.push({
      code: "WR2_LATE",
      detail: `WR2 was drafted in round ${wr2Round ?? "unknown"}; the deadline is round ${wr2Deadline}.`,
    });
  }
  const qbUsable = requirements.QB === 0
    ? null
    : qbStarterPosRank != null && qbStarterPosRank <= 18;
  const teTopSix = requirements.TE === 0
    ? null
    : teStarterPosRank != null && teStarterPosRank <= 6;
  const diagnosticIssues: DraftEvaluationIssue[] = [];
  if (qbUsable === false) {
    diagnosticIssues.push({
      code: "QB_BELOW_USABLE_FLOOR",
      detail: `Best rostered QB rank is ${qbStarterPosRank ?? "missing"}; the usable threshold is QB18.`,
    });
  }
  if (teTopSix === false) {
    diagnosticIssues.push({
      code: "TE_OUTSIDE_TOP_SIX",
      detail: `Best rostered TE rank is ${teStarterPosRank ?? "missing"}; top-six TE is a diagnostic, not a roster-validity rule.`,
    });
  }

  return {
    positionSequence,
    positionCounts,
    mandatoryPass: mandatoryIssues.length === 0,
    rosterComplete: openSlots.length === 0,
    endgamePass: endgameIssues.length === 0,
    coreConstructionPass: constructionIssues.length === 0,
    mandatoryIssues,
    endgameIssues,
    constructionIssues,
    diagnosticIssues,
    qbRound,
    qbStarterName: qbStarter?.player.name ?? null,
    qbStarterPosRank,
    qbUsable,
    qbEcrReachPicks,
    qbAdpReachPicks,
    teRound,
    teStarterName: teStarter?.player.name ?? null,
    teStarterPosRank,
    teTopSix,
    teEcrReachPicks,
    teAdpReachPicks,
    rbWrBenchAdpReachPicks,
    availabilityCounts,
    rankingsMayBeStalePickCount,
    rb2Round,
    wr2Round,
    kRound,
    defRound,
  };
}

function zeroAvailabilityCounts(): Record<DraftAvailabilityClass, number> {
  return {
    healthy: 0,
    "short-term-concern": 0,
    "material-risk": 0,
    unavailable: 0,
    unknown: 0,
  };
}

function meanRbWrBenchAdpReachPicks(
  resolvedPicks: readonly {
    pick: DraftResultArtifact["sleeper"]["picks"][number];
    player: DraftResultArtifact["players"]["all"][number];
  }[],
  requirements: Record<RosterSlot, number>
) {
  const roster: DraftResultArtifact["players"]["all"][number][] = [];
  let reach = 0;
  let measuredPicks = 0;

  for (const entry of resolvedPicks) {
    const { positionNeeds } = calculateTeamNeedsAndCountsForSingleTeam(
      roster,
      requirements
    );
    const isRbWrDepth =
      (entry.player.position === "RB" || entry.player.position === "WR") &&
      (positionNeeds[entry.player.position] ?? 0) === 0 &&
      (positionNeeds.FLEX ?? 0) === 0;
    const adp = finiteNumber(
      entry.player.sleeper_adp ?? entry.player.sleeperAdp
    );
    if (isRbWrDepth && adp != null) {
      reach += Math.max(0, adp - entry.pick.pick_no);
      measuredPicks += 1;
    }
    roster.push(entry.player);
  }

  return measuredPicks === 0
    ? null
    : Number((reach / measuredPicks).toFixed(2));
}

function starterReachPicks(
  starter: {
    pick: DraftResultArtifact["sleeper"]["picks"][number];
    player: DraftResultArtifact["players"]["all"][number];
  } | null,
  source: "ecr" | "adp"
) {
  if (!starter) return null;
  const marketPick = source === "ecr"
    ? finiteNumber(starter.player.fp_rank_ave)
    : finiteNumber(
        starter.player.sleeper_adp ?? starter.player.sleeperAdp
      );
  return marketPick == null
    ? null
    : Number(Math.max(0, marketPick - starter.pick.pick_no).toFixed(2));
}

export function evaluateCoreStarterEcr(
  artifact: DraftResultArtifact
): CoreStarterEcrEvaluation {
  const scores = Array.from({ length: artifact.summary.teams }, (_, index) => ({
    draftSlot: index + 1,
    score: coreStarterEcrScore(artifact, index + 1),
  }));
  const userScore = scores.find(
    (entry) => entry.draftSlot === artifact.summary.userSlot
  )?.score ?? null;
  if (userScore == null) return { score: null, finish: null };

  return {
    score: userScore,
    finish:
      1 +
      scores.filter(
        (entry) => entry.score != null && entry.score < userScore
      ).length,
  };
}

function coreStarterEcrScore(
  artifact: DraftResultArtifact,
  draftSlot: number
) {
  const playersById = new Map(
    artifact.players.all.map((player) => [player.player_id, player])
  );
  const roster = artifact.sleeper.picks
    .filter((pick) => pick.draft_slot === draftSlot)
    .flatMap((pick) => {
      const player = playersById.get(pick.player_id);
      return player ? [player] : [];
    });
  const selectedIds = new Set<string>();
  const selected: typeof roster = [];
  const requirements = artifact.state.config.rosterSlots;

  for (const position of ["QB", "RB", "WR", "TE"] as const) {
    const candidates = roster
      .filter(
        (player) =>
          player.position === position && !selectedIds.has(player.player_id)
      )
      .toSorted(playerEcrOrder)
      .slice(0, requirements[position]);
    for (const player of candidates) {
      selectedIds.add(player.player_id);
      selected.push(player);
    }
  }

  const flex = roster
    .filter(
      (player) =>
        (player.position === "RB" ||
          player.position === "WR" ||
          player.position === "TE") &&
        !selectedIds.has(player.player_id)
    )
    .toSorted(playerEcrOrder)
    .slice(0, requirements.FLEX);
  selected.push(...flex);

  const requiredCount =
    requirements.QB +
    requirements.RB +
    requirements.WR +
    requirements.TE +
    requirements.FLEX;
  const ranks = selected.map((player) => finiteNumber(player.fp_rank_ave));
  if (selected.length !== requiredCount || ranks.some((rank) => rank == null)) {
    return null;
  }
  return Number(
    ranks.reduce<number>((total, rank) => total + (rank ?? 0), 0).toFixed(2)
  );
}

function playerEcrOrder(
  left: DraftResultArtifact["players"]["all"][number],
  right: DraftResultArtifact["players"]["all"][number]
) {
  return nullableNumber(left.fp_rank_ave) - nullableNumber(right.fp_rank_ave);
}

function rosterRequirements(
  artifact: DraftResultArtifact
): Record<RosterSlot, number> {
  const slots = artifact.state.config.rosterSlots;
  return {
    QB: slots.QB,
    RB: slots.RB,
    WR: slots.WR,
    TE: slots.TE,
    K: slots.K,
    DEF: slots.DEF,
    FLEX: slots.FLEX,
    BN: slots.BENCH,
  };
}

function zeroPositionCounts(): Record<Position, number> {
  return {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableNumber(value: unknown) {
  return finiteNumber(value) ?? Number.POSITIVE_INFINITY;
}
