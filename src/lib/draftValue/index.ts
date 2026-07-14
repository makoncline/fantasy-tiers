import type { Position, RosterSlot } from "@/lib/schemas";

export type DraftComebackLabel = "likely" | "toss-up" | "unlikely" | "unknown";
export type DraftActionLabel = "take now" | "can wait" | "queue fallback" | "unknown";
export type DraftSourceConfidence = "high" | "medium" | "low";

export type DraftValueReasonCode =
  | "BEST_VALUE"
  | "TIER_CLIFF"
  | "LIKELY_GONE"
  | "ADP_BARGAIN"
  | "ROSTER_NEED"
  | "ROOM_DEMAND"
  | "BENCH_BALANCE"
  | "ELITE_QB_STARTER"
  | "ELITE_TE_STARTER"
  | "RB_ANCHOR"
  | "WR2_ANCHOR"
  | "WR_STARTER_WINDOW"
  | "STARTER_DEADLINE"
  | "QB_TOO_EARLY"
  | "TE_TOO_EARLY"
  | "NON_ELITE_TE_TOO_EARLY"
  | "QB_TIMING"
  | "QB_VIABLE_STARTER"
  | "QB_LOW_CEILING"
  | "ONESIE_FILLED"
  | "ONESIE_WAIT"
  | "BENCH_UPSIDE"
  | "K_DEF_WAIT"
  | "NEWS_RISK";

export type DraftValueReason = {
  code: DraftValueReasonCode;
  label: string;
  detail: string;
};

export type DraftRecommendationConfidence = "high" | "medium" | "low";

export type DraftRecommendationComponents = {
  value: number;
  timing: number;
  starterNeed: number;
  construction: number;
  onesie: number;
  depth: number;
  demand: number;
  risk: number;
};

export type DraftRecommendationComponentKey =
  keyof DraftRecommendationComponents;

export type DraftRecommendationWeights = {
  [K in DraftRecommendationComponentKey]: number;
};

export type DraftRecommendationWeightProfileId =
  | "starter_build"
  | "core_balance"
  | "depth_build"
  | "endgame";

export type DraftRecommendationWeightProfile = {
  id: DraftRecommendationWeightProfileId;
  label: string;
  weights: DraftRecommendationWeights;
};

export type DraftRecommendationComponent = {
  key: DraftRecommendationComponentKey;
  label: string;
  value: number;
};

export type DraftRecommendationEdgeLabel =
  | "Coin flip"
  | "Slight edge"
  | "Clear edge"
  | "Big edge"
  | "Only option";

export type DraftRecommendationExplanation = {
  edge: {
    label: DraftRecommendationEdgeLabel;
    detail: string;
  };
  pros: string[];
  cons: string[];
  dataQuality: string[];
};

export type DraftBenchBalance = {
  rbCount: number;
  wrCount: number;
  rbTarget: number;
  wrTarget: number;
  rbGap: number;
  wrGap: number;
  targetPosition: "RB" | "WR" | null;
  status: "balanced" | "tie-break" | "action";
  label: string;
  detail: string;
};

export type DraftRosterConstruction = {
  label: string;
  detail: string;
  warnings: string[];
  starterHoles: string[];
  flexOpen: number;
  benchDepth: Partial<Record<Position, number>>;
  benchBalance: DraftBenchBalance;
  byeWarnings: string[];
  guidance: string[];
};

export type DraftValueMetrics = {
  playerId: string;
  staticValue: number | null;
  recommendationScore: number;
  recommendationRank: number | null;
  valueRank: number | null;
  positionalValueRank: number | null;
  positionTier: number | null;
  tierCliff: number | null;
  sameTierFallbackCount: number;
  sleeperAdp: number | null;
  adpDeltaPicks: number | null;
  adpDeltaRounds: number | null;
  comebackProbability: number | null;
  comebackLabel: DraftComebackLabel;
  actionLabel: DraftActionLabel;
  urgencyScore: number;
  rosterFitScore: number;
  roomDemandScore: number;
  benchPolicyScore: number;
  rawScores: DraftRecommendationComponents;
  weights: DraftRecommendationWeights;
  weightProfile: DraftRecommendationWeightProfileId;
  weightProfileLabel: string;
  components: DraftRecommendationComponents;
  topComponents: DraftRecommendationComponent[];
  recommendationExplanation: DraftRecommendationExplanation;
  recommendationSummary: string;
  recommendationConfidence: DraftRecommendationConfidence | null;
  recommendationScoreGap: number | null;
  positionRunCount: number;
  sourceConfidence: DraftSourceConfidence;
  missingFields: string[];
  reasons: DraftValueReason[];
};

export type DraftValuePlayerInput = {
  player_id: string;
  name?: string | null | undefined;
  position: Position;
  bye_week?: number | string | null | undefined;
  rank?: number | null | undefined;
  tier?: number | null | undefined;
  tier_rank?: number | null | undefined;
  tier_level?: number | null | undefined;
  position_tier_level?: number | null | undefined;
  sleeper_tier_level?: number | null | undefined;
  fp_rank_ave?: number | null | undefined;
  fp_rank_std?: number | null | undefined;
  fp_rank_pos?: number | null | undefined;
  sleeper_adp?: number | null | undefined;
  sleeper_injury_status?: string | null | undefined;
  sleeper_injury_notes?: string | null | undefined;
  picked?: { overall?: number | null | undefined } | boolean | null | undefined;
  draftedByMe?: boolean | null | undefined;
  drafted?: boolean | null | undefined;
  sleeper?: unknown | undefined;
  fantasypros?: unknown | undefined;
};

export type DraftRosterPlayerInput = {
  name?: string | null | undefined;
  position: Position;
  bye_week?: number | string | null | undefined;
};

export type DraftTeamRosterState = {
  draftSlot: number;
  positionCounts: Partial<Record<Position, number>>;
  starterNeeds: Partial<Record<RosterSlot, number>>;
  benchSlotsRemaining?: number | null | undefined;
};

export type DraftValueBoardInput<TPlayer extends DraftValuePlayerInput> = {
  players: readonly TPlayer[];
  teams: number;
  rounds?: number | undefined;
  draftType?: string | null | undefined;
  currentPick: number;
  userSlot?: number | null | undefined;
  rosterRequirements: Partial<Record<RosterSlot, number>>;
  userPositionCounts: Partial<Record<Position | "FLEX" | "BN", number>>;
  userPositionNeeds: Partial<Record<RosterSlot, number>>;
  draftWideNeeds?: Partial<Record<Position | "FLEX", number>> | undefined;
  teamRosterStates?: readonly DraftTeamRosterState[] | undefined;
  userRosterPlayers?: readonly DraftRosterPlayerInput[] | undefined;
};

export type DraftValueBoard<TPlayer extends DraftValuePlayerInput> = {
  metricsByPlayerId: Record<string, DraftValueMetrics>;
  recommendations: TPlayer[];
  topRecommendation: {
    player: TPlayer;
    metrics: DraftValueMetrics;
    challengers: { playerId: string; score: number; scoreGap: number }[];
  } | null;
  nextPick: number | null;
  picksUntilNextTurn: number | null;
  rosterConstruction: DraftRosterConstruction;
};

const CORE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const FLEX_POSITIONS = ["RB", "WR", "TE"] as const satisfies readonly Position[];

const COMPONENT_LABELS = {
  value: "ECR value",
  timing: "Pick timing",
  starterNeed: "Starter need",
  construction: "Roster construction",
  onesie: "QB/TE strategy",
  depth: "Bench balance",
  demand: "League demand",
  risk: "Data/news risk",
} satisfies Record<DraftRecommendationComponentKey, string>;

const COMPONENT_KEYS = [
  "value",
  "timing",
  "starterNeed",
  "construction",
  "onesie",
  "depth",
  "demand",
  "risk",
] as const satisfies readonly DraftRecommendationComponentKey[];

const BASE_RECOMMENDATION_WEIGHTS = {
  value: 1,
  timing: 0.35,
  starterNeed: 0.65,
  construction: 0.55,
  onesie: 0.45,
  depth: 0.35,
  demand: 0.2,
  risk: 0.5,
} satisfies DraftRecommendationWeights;

function makeWeightProfile(
  id: DraftRecommendationWeightProfileId,
  label: string,
  overrides: Partial<DraftRecommendationWeights>
): DraftRecommendationWeightProfile {
  return {
    id,
    label,
    weights: { ...BASE_RECOMMENDATION_WEIGHTS, ...overrides },
  };
}

const RECOMMENDATION_WEIGHT_PROFILES = {
  starter_build: makeWeightProfile("starter_build", "Starter build", {
    starterNeed: 0.8,
    construction: 0.8,
    onesie: 0.9,
    depth: 0.2,
    risk: 0.6,
  }),
  core_balance: makeWeightProfile("core_balance", "Core balance", {
    timing: 0.4,
    starterNeed: 0.75,
    construction: 0.75,
    onesie: 1,
    depth: 0.25,
    risk: 0.6,
  }),
  depth_build: makeWeightProfile("depth_build", "Depth build", {
    value: 1.1,
    starterNeed: 0.3,
    construction: 0.45,
    onesie: 0.65,
    depth: 0.7,
    risk: 0.65,
  }),
  endgame: makeWeightProfile("endgame", "Endgame", {
    value: 0.8,
    timing: 0.2,
    starterNeed: 1,
    construction: 0.35,
    onesie: 1,
    depth: 0.25,
    demand: 0.1,
    risk: 0.65,
  }),
} satisfies Record<
  DraftRecommendationWeightProfileId,
  DraftRecommendationWeightProfile
>;

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const numeric = Number(value.replace(/[,%]/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function readNestedNumber(source: unknown, path: string[]): number | null {
  let current: unknown = source;
  for (const key of path) {
    const record = toRecord(current);
    if (!record || !(key in record)) return null;
    current = record[key];
  }
  return toNumber(current);
}

function readNestedString(source: unknown, path: string[]): string | null {
  let current: unknown = source;
  for (const key of path) {
    const record = toRecord(current);
    if (!record || !(key in record)) return null;
    current = record[key];
  }
  return typeof current === "string" && current.trim()
    ? current.trim()
    : null;
}

function isPicked(player: DraftValuePlayerInput) {
  if (player.drafted) return true;
  if (player.picked === true) return true;
  if (player.picked && typeof player.picked === "object") return true;
  return false;
}

function getAdp(player: DraftValuePlayerInput): number | null {
  const adp =
    toNumber(player.sleeper_adp) ??
    readNestedNumber(player.sleeper, ["stats", "adp"]);
  if (adp == null) return null;
  return adp >= 900 ? null : adp;
}

function getInjuryRisk(player: DraftValuePlayerInput) {
  const status =
    player.sleeper_injury_status ??
    readNestedString(player.sleeper, ["player", "injury_status"]);
  const notes =
    player.sleeper_injury_notes ??
    readNestedString(player.sleeper, ["player", "injury_notes"]);
  const normalized = status?.trim().toLowerCase() ?? "";
  if (!normalized || normalized === "healthy" || normalized === "active") {
    return { status: status ?? null, notes: notes ?? null, penalty: 0 };
  }
  const severe = ["out", "ir", "pup", "suspended", "doubtful"].some((needle) =>
    normalized.includes(needle)
  );
  return {
    status: status ?? null,
    notes: notes ?? null,
    penalty: severe ? 8 : 3,
  };
}

function getRank(player: DraftValuePlayerInput): number | null {
  return toNumber(player.tier_rank) ?? toNumber(player.rank);
}

function getFpOverallRank(player: DraftValuePlayerInput): number | null {
  return toNumber(player.fp_rank_ave);
}

function getFpPositionRank(player: DraftValuePlayerInput): number | null {
  return toNumber(player.fp_rank_pos);
}

function getTier(player: DraftValuePlayerInput): number | null {
  return toNumber(player.tier_level) ?? toNumber(player.tier);
}

function getPositionTier(player: DraftValuePlayerInput): number | null {
  return (
    toNumber(player.position_tier_level) ?? toNumber(player.sleeper_tier_level)
  );
}

function countRequiredStarters(
  teams: number,
  rosterRequirements: Partial<Record<RosterSlot, number>>
): Record<Position, number> {
  const base: Record<Position, number> = {
    QB: teams * (rosterRequirements.QB ?? 0),
    RB: teams * (rosterRequirements.RB ?? 0),
    WR: teams * (rosterRequirements.WR ?? 0),
    TE: teams * (rosterRequirements.TE ?? 0),
    K: teams * (rosterRequirements.K ?? 0),
    DEF: teams * (rosterRequirements.DEF ?? 0),
  };

  let flexSlots = teams * (rosterRequirements.FLEX ?? 0);
  const flexOrder = ["WR", "RB", "TE"] as const;
  while (flexSlots > 0) {
    for (const pos of flexOrder) {
      if (flexSlots <= 0) break;
      base[pos] += 1;
      flexSlots -= 1;
    }
  }

  return base;
}

function replacementBuffer(position: Position, teams: number) {
  if (position === "K" || position === "DEF") return Math.ceil(teams * 0.25);
  if (position === "QB" || position === "TE") return Math.ceil(teams * 0.5);
  return teams;
}

function rankBaseline(position: Position, starters: Record<Position, number>, teams: number) {
  return Math.max(1, (starters[position] || teams) + replacementBuffer(position, teams));
}

function rankBasedValueScore(args: {
  player: DraftValuePlayerInput;
  starters: Record<Position, number>;
  teams: number;
}) {
  const overallRank = getFpOverallRank(args.player);
  const positionRank = getFpPositionRank(args.player);
  const tier = getTier(args.player);
  if (overallRank == null) {
    return {
      score: null,
      overallRank,
      positionRank,
      tier,
    };
  }
  const baseline = rankBaseline(args.player.position, args.starters, args.teams);
  const overallScore =
    Math.max(0, 180 - overallRank) * 0.75;
  const positionScore =
    positionRank == null ? 0 : Math.max(-20, baseline - positionRank) * 1.25;
  const tierScore = tier == null ? 0 : Math.max(0, 12 - tier) * 4;
  const score = overallScore + positionScore + tierScore;
  return {
    score: roundOne(score),
    overallRank,
    positionRank,
    tier,
  };
}

function pickSlot(overall: number, teams: number, draftType?: string | null) {
  if (!overall || !teams) return null;
  const pickInRound = ((overall - 1) % teams) + 1;
  const round = Math.ceil(overall / teams);
  if (String(draftType ?? "").toLowerCase() === "linear") return pickInRound;
  return round % 2 === 1 ? pickInRound : teams - pickInRound + 1;
}

export function getNextPickForSlot(args: {
  currentPick: number;
  userSlot?: number | null | undefined;
  teams: number;
  rounds?: number | undefined;
  draftType?: string | null | undefined;
}) {
  const { currentPick, userSlot, teams, rounds, draftType } = args;
  if (!userSlot || !teams || teams <= 0) return null;
  const maxPick = teams * Math.max(rounds ?? 30, 1);
  for (let pick = Math.max(1, currentPick); pick <= maxPick; pick += 1) {
    if (pickSlot(pick, teams, draftType) === userSlot) return pick;
  }
  return null;
}

function defaultAdpSpread(adp: number | null, teams: number) {
  if (adp == null) return Math.max(teams, 10);
  if (adp <= teams * 2) return Math.max(4, teams * 0.6);
  if (adp <= teams * 8) return Math.max(8, teams);
  return Math.max(12, teams * 1.5);
}

function comebackProbability(adp: number | null, nextPick: number | null, teams: number) {
  if (adp == null || nextPick == null) return null;
  const spread = defaultAdpSpread(adp, teams);
  const z = (nextPick - adp) / spread;
  return 1 / (1 + Math.exp(1.35 * z));
}

function adjustedComebackProbability(args: {
  adp: number | null;
  position: Position;
  currentPick: number;
  nextPick: number | null;
  comebackTargetPick: number | null;
  teams: number;
  draftType?: string | null | undefined;
  teamRosterStates?: readonly DraftTeamRosterState[] | undefined;
}) {
  const base = comebackProbability(args.adp, args.comebackTargetPick, args.teams);
  if (
    base == null ||
    args.comebackTargetPick == null ||
    !args.teamRosterStates?.length
  ) {
    return base;
  }

  const userOnClock = args.nextPick === args.currentPick;
  const startPick = userOnClock ? args.currentPick + 1 : args.currentPick;
  const endPick = args.comebackTargetPick - 1;
  if (startPick > endPick) return base;

  const statesBySlot = new Map(
    args.teamRosterStates.map((state) => [state.draftSlot, state] as const)
  );
  let expectedPositionPicks = 0;
  let picksBeforeTarget = 0;

  for (let pick = startPick; pick <= endPick; pick += 1) {
    const slot = pickSlot(pick, args.teams, args.draftType);
    if (slot == null) continue;
    const state = statesBySlot.get(slot);
    if (!state) continue;
    expectedPositionPicks += teamPositionDemandWeight(args.position, state);
    picksBeforeTarget += 1;
  }

  if (picksBeforeTarget === 0) return base;

  const neutralExpected =
    picksBeforeTarget * neutralPositionPickShare(args.position);
  const demandPressure = expectedPositionPicks - neutralExpected;
  const adjusted = base * Math.exp(-0.38 * demandPressure);
  return clampProbability(adjusted);
}

function teamPositionDemandWeight(
  position: Position,
  state: DraftTeamRosterState
) {
  const count = state.positionCounts[position] ?? 0;
  const starterNeed = state.starterNeeds[position] ?? 0;
  const flexNeed = isFlexPosition(position) ? state.starterNeeds.FLEX ?? 0 : 0;
  const benchSlotsRemaining = Math.max(0, state.benchSlotsRemaining ?? 0);

  if ((position === "K" || position === "DEF") && count >= 1) return 0.01;
  if ((position === "QB" || position === "TE") && count >= 2) return 0.02;

  let weight = 0;
  if (starterNeed > 0) weight += position === "K" || position === "DEF" ? 0.45 : 0.75;
  if (flexNeed > 0) {
    weight += position === "TE" ? 0.08 : 0.28;
  }

  if (benchSlotsRemaining > 0) {
    if (position === "RB" || position === "WR") {
      weight += 0.22;
      const otherCount = state.positionCounts[position === "RB" ? "WR" : "RB"] ?? 0;
      if (count < otherCount) weight += 0.08;
    } else if ((position === "QB" || position === "TE") && count < 2) {
      weight += 0.04;
    } else if ((position === "K" || position === "DEF") && count < 1 && starterNeed > 0) {
      weight += 0.08;
    }
  }

  return Math.min(0.95, Math.max(0.01, weight));
}

function neutralPositionPickShare(position: Position) {
  if (position === "RB") return 0.3;
  if (position === "WR") return 0.32;
  if (position === "TE") return 0.11;
  if (position === "QB") return 0.1;
  return 0.04;
}

function clampProbability(value: number) {
  return Math.max(0.01, Math.min(0.99, value));
}

function comebackLabel(probability: number | null): DraftComebackLabel {
  if (probability == null) return "unknown";
  if (probability >= 0.7) return "likely";
  if (probability >= 0.4) return "toss-up";
  return "unlikely";
}

function buildActionLabel(
  probability: number | null,
  sameTierFallbackCount: number,
  urgencyScore: number
): DraftActionLabel {
  if (probability == null) return "unknown";
  if (probability < 0.35 || urgencyScore >= 8) return "take now";
  if (probability < 0.65 || sameTierFallbackCount <= 1) return "queue fallback";
  return "can wait";
}

function inferRosterConstruction(args: {
  counts: Partial<Record<Position | "FLEX" | "BN", number>>;
  needs: Partial<Record<RosterSlot, number>>;
  requirements: Partial<Record<RosterSlot, number>>;
  players?: readonly DraftRosterPlayerInput[] | undefined;
}): DraftRosterConstruction {
  const { counts, needs, requirements } = args;
  const rb = counts.RB ?? 0;
  const wr = counts.WR ?? 0;
  const qb = counts.QB ?? 0;
  const te = counts.TE ?? 0;
  const total = CORE_POSITIONS.reduce((sum, pos) => sum + (counts[pos] ?? 0), 0);
  const warnings: string[] = [];
  const starterHoles = CORE_POSITIONS.filter(
    (pos) => (needs[pos] ?? 0) > 0
  ).map((pos) => `${pos} ${(needs[pos] ?? 0).toString()}`);
  const flexOpen = needs.FLEX ?? 0;
  const benchDepth = Object.fromEntries(
    CORE_POSITIONS.map((pos) => [
      pos,
      Math.max(0, (counts[pos] ?? 0) - (requirements[pos] ?? 0)),
    ])
  ) as Partial<Record<Position, number>>;
  const byeWarnings = buildByeWarnings(args.players ?? []);
  const benchBalance = calculateBenchBalance({ counts, needs, requirements });
  const guidance: string[] = [];

  if ((needs.QB ?? 0) > 0 && total >= 10) {
    warnings.push("QB starter is still open late.");
  }
  if ((needs.TE ?? 0) > 0 && total >= 10) {
    warnings.push("TE starter is still open late.");
  }
  if ((needs.RB ?? 0) > 0 && total >= 5) {
    warnings.push("RB starter quality is getting fragile.");
  }
  if ((needs.WR ?? 0) > 0 && total >= 5) {
    warnings.push("WR starter quality is getting fragile.");
  }
  if (rb >= 1 && wr === 0 && (needs.WR ?? 0) > 0) {
    warnings.push("WR starter anchor is still open; compare before doubling RB.");
  }
  if (wr >= 1 && rb === 0 && (needs.RB ?? 0) > 0) {
    warnings.push("RB starter anchor is still open; compare before doubling WR.");
  }
  if (benchBalance.status === "action" && benchBalance.targetPosition) {
    warnings.push(
      `RB/WR bench depth is lopsided; prefer ${benchBalance.targetPosition} unless the value gap is clear.`
    );
  }
  warnings.push(...byeWarnings);

  if (starterHoles.length) {
    guidance.push("Starter holes still matter unless the value gap is clear.");
  }
  if (flexOpen > 0) {
    guidance.push("Prioritize RB/WR/TE values that can improve flex quality.");
  }
  if (total >= 10 && ((needs.K ?? 0) > 0 || (needs.DEF ?? 0) > 0)) {
    guidance.push("Kicker and defense are acceptable only after core depth is stable.");
  }
  if (benchBalance.status === "tie-break" && benchBalance.targetPosition) {
    guidance.push(
      `Use bench balance as a tie-breaker: lean ${benchBalance.targetPosition}.`
    );
  }

  const shared = {
    warnings,
    starterHoles,
    flexOpen,
    benchDepth,
    benchBalance,
    byeWarnings,
    guidance,
  };

  if (qb > 0 && total <= 4) {
    return {
      label: "Early QB",
      detail: "Quarterback is secured early, so RB/WR/flex value should carry extra weight.",
      ...shared,
    };
  }
  if (te > 0 && total <= 4) {
    return {
      label: "Early TE",
      detail: "Tight end is secured early, so avoid forcing another onesie unless value is clear.",
      ...shared,
    };
  }
  if (rb === 1 && wr >= 1) {
    return {
      label: "Hero RB",
      detail: "One anchor RB is in place; WR/flex value can stay aggressive while RB depth is monitored.",
      ...shared,
    };
  }
  if (rb === 0 && wr >= 2) {
    return {
      label: "WR-heavy",
      detail: "This build is leaning WR-heavy, so RB urgency should rise when value tiers thin out.",
      ...shared,
    };
  }
  if (rb >= 2 && wr <= 1) {
    return {
      label: "RB-heavy",
      detail: "RB volume is secured; WR value and flex balance should be watched closely.",
      ...shared,
    };
  }
  return {
    label: total === 0 ? "Open build" : "Balanced",
    detail: "No rigid strategy lock is active; take the best value with roster fit as a modifier.",
    ...shared,
  };
}

function calculateBenchBalance(args: {
  counts: Partial<Record<Position | "FLEX" | "BN", number>>;
  needs: Partial<Record<RosterSlot, number>>;
  requirements: Partial<Record<RosterSlot, number>>;
}): DraftBenchBalance {
  const rbCount = Math.max(0, args.counts.RB ?? 0);
  const wrCount = Math.max(0, args.counts.WR ?? 0);
  const flexibleDepthSlots = Math.max(
    0,
    (args.requirements.FLEX ?? 0) + (args.requirements.BN ?? 0)
  );
  const rbTarget = Math.max(
    0,
    (args.requirements.RB ?? 0) + Math.ceil(flexibleDepthSlots / 2)
  );
  const wrTarget = Math.max(
    0,
    (args.requirements.WR ?? 0) + Math.floor(flexibleDepthSlots / 2)
  );
  const rbGap = Math.max(0, rbTarget - rbCount);
  const wrGap = Math.max(0, wrTarget - wrCount);
  const coreRbWrOpen =
    (args.needs.RB ?? 0) > 0 ||
    (args.needs.WR ?? 0) > 0 ||
    (args.needs.FLEX ?? 0) > 0;
  if (coreRbWrOpen) {
    return {
      rbCount,
      wrCount,
      rbTarget,
      wrTarget,
      rbGap,
      wrGap,
      targetPosition: null,
      status: "balanced",
      label: "Core first",
      detail: "Fill RB/WR/FLEX starter quality before using bench balance.",
    };
  }

  const depthFloor = Math.min(rbTarget, wrTarget);
  const floorTargetPosition =
    rbCount < depthFloor && wrCount >= depthFloor
      ? "RB"
      : wrCount < depthFloor && rbCount >= depthFloor
        ? "WR"
        : null;
  const targetPosition =
    floorTargetPosition ??
    (rbGap === wrGap ? null : rbGap > wrGap ? "RB" : "WR");
  const countDifference = Math.abs(rbCount - wrCount);
  const gapDifference = Math.abs(rbGap - wrGap);
  const status =
    targetPosition == null
      ? "balanced"
      : floorTargetPosition != null
        ? "action"
      : countDifference >= 3 || gapDifference >= 3 || (countDifference >= 1 && gapDifference >= 2)
        ? "action"
        : "tie-break";
  const label =
    status === "balanced"
      ? "Balanced"
      : `${status === "action" ? "Action" : "Tie-break"} ${targetPosition}`;
  const detail =
    status === "balanced"
      ? "RB/WR depth is close enough; let value decide."
      : status === "action"
        ? `RB/WR depth is materially uneven; prefer ${targetPosition} unless the value gap is clear.`
        : `RB/WR depth slightly favors ${targetPosition} as a tie-breaker.`;

  return {
    rbCount,
    wrCount,
    rbTarget,
    wrTarget,
    rbGap,
    wrGap,
    targetPosition,
    status,
    label,
    detail,
  };
}

function buildByeWarnings(players: readonly DraftRosterPlayerInput[]) {
  const byPositionBye = new Map<string, DraftRosterPlayerInput[]>();
  const flexByBye = new Map<string, DraftRosterPlayerInput[]>();
  for (const player of players) {
    if (player.bye_week == null) continue;
    const bye = String(player.bye_week);
    if (!bye || bye === "0") continue;
    const key = `${player.position}:${bye}`;
    byPositionBye.set(key, [...(byPositionBye.get(key) ?? []), player]);
    if (isFlexPosition(player.position)) {
      flexByBye.set(bye, [...(flexByBye.get(bye) ?? []), player]);
    }
  }

  const warnings: string[] = [];
  for (const [key, sameByePlayers] of byPositionBye) {
    const [position, bye] = key.split(":");
    if ((position === "QB" || position === "TE") && sameByePlayers.length >= 2) {
      warnings.push(`${position} bye overlap in Week ${bye}.`);
    }
  }
  for (const [bye, sameByePlayers] of flexByBye) {
    if (sameByePlayers.length >= 3) {
      warnings.push(`${sameByePlayers.length} RB/WR/TE players share Week ${bye} bye.`);
    }
  }
  return warnings;
}

function rosterFitScore(args: {
  position: Position;
  currentPick: number;
  rounds?: number | undefined;
  teams: number;
  needs: Partial<Record<RosterSlot, number>>;
  counts: Partial<Record<Position | "FLEX" | "BN", number>>;
}) {
  const { position, currentPick, rounds, teams, needs, counts } = args;
  const currentRound = teams > 0 ? Math.ceil(currentPick / teams) : 1;
  let score = 0;
  const directNeed = needs[position] ?? 0;
  const flexNeed = isFlexPosition(position) ? needs.FLEX ?? 0 : 0;
  const benchNeed = needs.BN ?? 0;
  const coreNeeds =
    (needs.RB ?? 0) + (needs.WR ?? 0) + (needs.FLEX ?? 0);
  const nonSpecialStarterNeeds =
    (needs.QB ?? 0) +
    (needs.RB ?? 0) +
    (needs.WR ?? 0) +
    (needs.TE ?? 0) +
    (needs.FLEX ?? 0);
  const specialNeeds = (needs.K ?? 0) + (needs.DEF ?? 0);
  const rbWrStarterNeeds = (needs.RB ?? 0) + (needs.WR ?? 0);
  const canFillStarter = directNeed > 0 || flexNeed > 0;

  if (directNeed > 0) score += 10 + directNeed * 4;
  if (flexNeed > 0) score += 4;
  if (position === "RB" || position === "WR") score += 1.5;
  score += rbWrStarterBalanceScore({
    position,
    currentRound,
    needs,
    counts,
  });
  if (position === "TE" && (counts.TE ?? 0) === 0) score += 1;
  if (
    position === "TE" &&
    directNeed > 0 &&
    currentRound >= 6 &&
    coreNeeds <= 0
  ) {
    score += currentRound >= 8 ? 12 : 8;
  }

  if (
    (position === "RB" || position === "WR") &&
    directNeed <= 0 &&
    flexNeed <= 0 &&
    coreNeeds > 0
  ) {
    score -= 10 + coreNeeds * 4;
  }
  if (
    benchNeed > 0 &&
    !canFillStarter &&
    nonSpecialStarterNeeds > 0 &&
    (position === "RB" || position === "WR" || position === "QB" || position === "TE")
  ) {
    score -= 6 + nonSpecialStarterNeeds * 2;
  }
  if (benchNeed <= 0 && !canFillStarter) {
    score -= 80;
  }
  if (nonSpecialStarterNeeds === 0 && specialNeeds > 0 && benchNeed <= 0) {
    if (
      (position === "K" && (needs.K ?? 0) > 0) ||
      (position === "DEF" && (needs.DEF ?? 0) > 0)
    ) {
      score += 25;
    } else if (benchNeed <= 0) {
      score -= 40;
    }
  }

  const lateRound = rounds ? currentRound >= Math.max(1, rounds - 2) : false;
  if ((position === "K" || position === "DEF") && !lateRound) score -= 8;
  if ((position === "QB" || position === "TE") && (counts[position] ?? 0) > 0) {
    score -= 3;
  }
  return score;
}

function rbWrStarterBalanceScore(args: {
  position: Position;
  currentRound: number;
  needs: Partial<Record<RosterSlot, number>>;
  counts: Partial<Record<Position | "FLEX" | "BN", number>>;
}) {
  if (args.position !== "RB" && args.position !== "WR") return 0;
  if (args.currentRound > 6) return 0;

  const rb = args.counts.RB ?? 0;
  const wr = args.counts.WR ?? 0;
  const te = args.counts.TE ?? 0;
  const rbNeed = args.needs.RB ?? 0;
  const wrNeed = args.needs.WR ?? 0;
  const flexNeed = args.needs.FLEX ?? 0;

  if (args.position === "WR" && wrNeed > 0) {
    if (rb >= 2 && wr === 0) return 34;
    if (rb >= 1 && wr === 0) return 32;
    if (rb >= 2 && wr === 1) return 34;
  }

  if (args.position === "RB" && rbNeed > 0) {
    if (wr >= 2 && rb === 0) return 30;
    if (wr >= 1 && rb === 0) return 16;
  }

  if (args.position === "RB" && wrNeed > 0) {
    if (rb >= 2 && wr === 0) return -38;
    if (rb >= 1 && wr === 0) return -30;
    if (rb >= 3 && wr <= 1) return -60;
    if (rb >= 2 && wr === 1 && flexNeed > 0) return -52;
  }

  if (args.position === "WR" && rbNeed > 0) {
    if (wr >= 2 && rb === 0) return -34;
    if (wr >= 1 && rb === 0) return -14;
  }

  return 0;
}

function rbAnchorPolicy(args: {
  position: Position;
  currentRound: number;
  needs: Partial<Record<RosterSlot, number>>;
  counts: Partial<Record<Position | "FLEX" | "BN", number>>;
}): { score: number; reasons: DraftValueReason[] } {
  const rb = args.counts.RB ?? 0;
  const wr = args.counts.WR ?? 0;
  const te = args.counts.TE ?? 0;
  const rbNeed = args.needs.RB ?? 0;
  const wrHeavy = wr >= 2;
  const inAnchorWindow =
    rb === 0 &&
    rbNeed > 0 &&
    ((wrHeavy && args.currentRound <= 4) ||
      (wr === 1 && args.currentRound <= 3));
  const inRb2AnchorWindow =
    rb === 1 &&
    wr >= 2 &&
    rbNeed > 0 &&
    args.currentRound >= 4 &&
    args.currentRound <= 5;
  const inBalancedRb2Window =
    rb === 1 &&
    wr >= 1 &&
    te >= 1 &&
    rbNeed > 0 &&
    args.currentRound >= 4 &&
    args.currentRound <= 5;

  if (!inAnchorWindow) {
    if (!inRb2AnchorWindow && !inBalancedRb2Window) {
      return { score: 0, reasons: [] };
    }

    const reasons: DraftValueReason[] = [];
    if (args.position === "RB") {
      reasons.push({
        code: "RB_ANCHOR",
        label: "RB2 anchor",
        detail:
          wr >= 2
            ? "Two WR are rostered and RB2 is still open; use close round-four or round-five value to avoid a fragile RB build."
            : "RB, WR, and TE are started but RB2 is still open; use close round-four or round-five value to avoid a fragile RB build.",
      });
      return { score: inBalancedRb2Window ? 50 : 16, reasons };
    }

    if (args.position === "WR" || args.position === "QB" || args.position === "TE") {
      reasons.push({
        code: "RB_ANCHOR",
        label: "RB2 still open",
        detail:
          wr >= 2
            ? "Two WR are rostered and RB2 is still open; this pick needs a clear value edge to wait on RB."
            : "RB, WR, and TE are started but RB2 is still open; this pick needs a clear value edge to wait on RB.",
      });
      return { score: inBalancedRb2Window ? -10 : -10, reasons };
    }

    return { score: 0, reasons };
  }

  const reasons: DraftValueReason[] = [];
  if (args.position === "RB") {
    reasons.push({
      code: "RB_ANCHOR",
      label: "RB anchor",
      detail:
        wrHeavy
          ? "Two WR are rostered and RB is still empty; get the first RB before adding another position."
          : "One WR is rostered and RB is still empty; use close round-two value to get the first RB.",
    });
    return {
      score: wrHeavy ? (args.currentRound <= 3 ? 72 : 58) : 44,
      reasons,
    };
  }

  if (args.position === "WR" || args.position === "QB" || args.position === "TE") {
    reasons.push({
      code: "RB_ANCHOR",
      label: "RB still empty",
      detail:
        wrHeavy
          ? "Two WR are rostered and RB is still empty; this pick needs a clear value edge to wait on RB."
          : "One WR is rostered and RB is still empty; this pick needs a clear value edge to wait on RB.",
    });
    return {
      score: wrHeavy ? (args.currentRound <= 3 ? -68 : -52) : -38,
      reasons,
    };
  }

  return { score: 0, reasons };
}

function benchPolicy(args: {
  position: Position;
  currentPick: number;
  rounds?: number | undefined;
  teams: number;
  needs: Partial<Record<RosterSlot, number>>;
  counts: Partial<Record<Position | "FLEX" | "BN", number>>;
  requirements: Partial<Record<RosterSlot, number>>;
  benchBalance: DraftBenchBalance;
}): { score: number; reasons: DraftValueReason[] } {
  const {
    position,
    currentPick,
    rounds,
    teams,
    needs,
    counts,
    requirements,
    benchBalance,
  } = args;
  const currentRound = teams > 0 ? Math.ceil(currentPick / teams) : 1;
  const finalRound = rounds ? currentRound >= rounds : false;
  const finalTwoRounds = rounds ? currentRound >= Math.max(1, rounds - 1) : false;
  const benchOpen = (needs.BN ?? 0) > 0;
  const nonSpecialStarterNeeds =
    (needs.QB ?? 0) +
    (needs.RB ?? 0) +
    (needs.WR ?? 0) +
    (needs.TE ?? 0) +
    (needs.FLEX ?? 0);
  const reasons: DraftValueReason[] = [];
  let score = 0;

  if (position === "K" && (counts.K ?? 0) > 0) {
    score -= 25;
    reasons.push({
      code: "ONESIE_FILLED",
      label: "K done",
      detail: "Kicker bench slots have very low draft utility.",
    });
  } else if (position === "DEF" && (counts.DEF ?? 0) > 0) {
    score -= 25;
    reasons.push({
      code: "ONESIE_FILLED",
      label: "DEF done",
      detail: "Defense bench slots are better used on RB/WR upside.",
    });
  } else if (position === "K" && !finalRound) {
    score -= (nonSpecialStarterNeeds > 0 ? 24 : 16) + (benchOpen ? 12 : 0);
    reasons.push({
      code: "K_DEF_WAIT",
      label: "K last",
      detail: "Kicker should normally be saved for the final pick.",
    });
  } else if (position === "DEF" && !finalTwoRounds) {
    score -= (nonSpecialStarterNeeds > 0 ? 20 : 14) + (benchOpen ? 8 : 0);
    reasons.push({
      code: "K_DEF_WAIT",
      label: "DEF late",
      detail: "Defense should usually wait until the final two rounds.",
    });
  }

  if (
    position === "QB" &&
    (requirements.QB ?? 0) <= 1 &&
    (counts.QB ?? 0) >= (requirements.QB ?? 1)
  ) {
    score -= 70;
    reasons.push({
      code: "ONESIE_FILLED",
      label: "QB done",
      detail: "In 1QB redraft, a bench QB usually loses to RB/WR upside.",
    });
  }

  if (
    position === "TE" &&
    (requirements.TE ?? 0) <= 1 &&
    (counts.TE ?? 0) >= (requirements.TE ?? 1)
  ) {
    score -= 85;
    reasons.push({
      code: "ONESIE_FILLED",
      label: "TE done",
      detail: "A second TE usually loses to RB/WR upside in 1TE redraft.",
    });
  }

  if (benchOpen && (position === "RB" || position === "WR")) {
    score += 3;
    reasons.push({
      code: "BENCH_UPSIDE",
      label: "Bench upside",
      detail: "Open bench slots are best spent on RB/WR paths to starter value.",
    });
  }

  if (position === "RB" || position === "WR") {
    if (benchOpen && benchBalance.targetPosition === position) {
      score += benchBalance.status === "action" ? 18 : 6;
      reasons.push({
        code: "BENCH_BALANCE",
        label: `${position} balance`,
        detail: benchBalance.detail,
      });
    } else if (
      benchOpen &&
      benchBalance.status === "action" &&
      benchBalance.targetPosition != null
    ) {
      score -= 12;
      reasons.push({
        code: "BENCH_BALANCE",
        label: "Balance risk",
        detail: benchBalance.detail,
      });
    }
  }

  const rbDepthShallow =
    benchOpen &&
    currentRound >= 6 &&
    currentRound <= 8 &&
    (needs.RB ?? 0) <= 0 &&
    (needs.WR ?? 0) <= 0 &&
    (counts.RB ?? 0) < 3 &&
    (counts.WR ?? 0) >= 2;
  if (rbDepthShallow && position === "RB") {
    score += 76;
    reasons.push({
      code: "BENCH_BALANCE",
      label: "RB depth",
      detail:
        "Mid-round RB depth is still shallow; use close RB value before WR depth gets redundant.",
    });
  } else if (rbDepthShallow && position === "WR") {
    score -= 8;
    reasons.push({
      code: "BENCH_BALANCE",
      label: "RB depth risk",
      detail:
        "WR depth is already adequate; this pick can leave RB depth thin.",
    });
  }

  const lateRbFloorOpen =
    benchOpen &&
    currentRound >= 10 &&
    currentRound <= 13 &&
    (needs.RB ?? 0) <= 0 &&
    (needs.WR ?? 0) <= 0 &&
    (counts.RB ?? 0) < 6 &&
    (counts.WR ?? 0) >= 5;
  if (lateRbFloorOpen && position === "RB") {
    score += 38;
    reasons.push({
      code: "BENCH_BALANCE",
      label: "RB floor",
      detail:
        "Late bench build still needs RB depth; add RB before taking extra WR depth.",
    });
  } else if (lateRbFloorOpen && position === "WR") {
    score -= 8;
    reasons.push({
      code: "BENCH_BALANCE",
      label: "RB floor risk",
      detail:
        "WR depth is already strong; this pick can leave the RB bench short.",
    });
  }

  return { score: roundOne(score), reasons };
}

function onesieStarterPolicy(args: {
  position: Position;
  currentPick: number;
  teams: number;
  needs: Partial<Record<RosterSlot, number>>;
  requirements: Partial<Record<RosterSlot, number>>;
  positionalRank: number | null;
  isEliteQbStarter: boolean;
  isEliteTeStarter: boolean;
  isViableQbStarter: boolean;
  isLowCeilingQbStarter: boolean;
  isQbPreAdpReach: boolean;
  adpDeltaPicks: number | null;
}): {
  score: number;
  qbEarlyScore: number;
  teEarlyScore: number;
  reasons: DraftValueReason[];
} {
  const {
    position,
    currentPick,
    teams,
    needs,
    requirements,
    positionalRank,
    isEliteQbStarter,
    isEliteTeStarter,
    isViableQbStarter,
    isLowCeilingQbStarter,
    isQbPreAdpReach,
    adpDeltaPicks,
  } = args;
  const currentRound = teams > 0 ? Math.ceil(currentPick / teams) : 1;
  const rbWrStarterNeeds = (needs.RB ?? 0) + (needs.WR ?? 0);
  const starterDeadlineOpen = rbWrStarterNeeds <= 0;
  const topSixStarterWindow =
    positionalRank != null &&
    positionalRank <= 6 &&
    starterDeadlineOpen &&
    (needs.FLEX ?? 0) > 0 &&
    (position !== "TE" || currentRound >= 6) &&
    currentRound >= 5 &&
    currentRound <= 8;
  const qbDeadlineWindow =
    position === "QB" &&
    starterDeadlineOpen &&
    (needs.QB ?? 0) > 0 &&
    currentRound >= 8;
  const teDeadlineWindow =
    position === "TE" &&
    starterDeadlineOpen &&
    (needs.TE ?? 0) > 0 &&
    currentRound >= 6;
  const reasons: DraftValueReason[] = [];
  let score = 0;
  let qbEarlyScore = 0;
  let teEarlyScore = 0;

  if (
    position === "QB" &&
    (requirements.QB ?? 0) <= 1 &&
    (needs.QB ?? 0) > 0
  ) {
    if (currentRound <= 3 && !isEliteQbStarter) {
      qbEarlyScore -= 26;
      reasons.push({
        code: "QB_TOO_EARLY",
        label: "QB too early",
        detail:
          "Rounds 1-3 should usually build RB/WR or elite TE; only take QB here for extreme elite value.",
      });
    } else if (currentRound <= 6 && !isEliteQbStarter) {
      qbEarlyScore -= 10;
      reasons.push({
        code: "QB_TOO_EARLY",
        label: "QB too early",
        detail:
          "Before round 7, non-elite QB needs a clear value edge over RB/WR/TE.",
      });
    }

    if (isQbPreAdpReach) {
      score -= 5;
      qbEarlyScore -= currentRound <= 6 ? 12 : currentRound >= 9 ? 0 : 6;
      reasons.push({
        code: "ONESIE_WAIT",
        label: "QB wait",
        detail:
          positionalRank != null && positionalRank <= 3 && adpDeltaPicks != null
            ? `QB${positionalRank} is still ${roundOne(adpDeltaPicks)} picks before ADP; do not reach while RB/WR/TE value remains.`
            : "This QB is still before ADP; compare RB/WR/TE first.",
      });
    } else if (isEliteQbStarter) {
      score += 5;
    } else if (topSixStarterWindow) {
      score += 14;
    } else if (qbDeadlineWindow) {
      score += isLowCeilingQbStarter
        ? currentRound >= 12
          ? 8
          : -8
        : isViableQbStarter
          ? currentRound >= 10
            ? 38
            : currentRound >= 9
              ? 28
              : 20
          : currentRound >= 12
            ? 14
            : 0;
      reasons.push({
        code: "STARTER_DEADLINE",
        label: "QB deadline",
        detail: isLowCeilingQbStarter
          ? "QB starter is still open, but this option is below the usable starter floor; avoid panic-picking unless the draft is almost over."
          : isViableQbStarter
            ? "QB starter is still open; fill it before the usable QB tier gets thin."
            : "QB starter is still open, but this QB is not clearly above the streaming tier.",
      });
    } else if (currentRound <= 8) {
      score -= 5;
      reasons.push({
        code: "ONESIE_WAIT",
        label: "QB wait",
        detail:
          positionalRank == null
            ? "Without a top-tier signal, QB can usually wait while RB/WR/FLEX value remains."
            : `QB${positionalRank} is not an elite separation pick; compare RB/WR/FLEX first.`,
      });
    }
  }

  if (
    position === "TE" &&
    (requirements.TE ?? 0) <= 1 &&
    (needs.TE ?? 0) > 0 &&
    !isEliteTeStarter &&
    !topSixStarterWindow &&
    !teDeadlineWindow &&
    currentRound <= 8
  ) {
    const coreNeeds =
      (needs.RB ?? 0) + (needs.WR ?? 0) + (needs.FLEX ?? 0);
    score -= coreNeeds > 0 ? 14 : 6;
    if (currentRound <= 2) {
      teEarlyScore -= 28;
      reasons.push({
        code: "TE_TOO_EARLY",
        label: "TE too early",
        detail:
          "Rounds 1-2 are only for clear elite TE exceptions; build RB/WR value first.",
      });
    } else if (currentRound <= 5) {
      teEarlyScore -= currentRound <= 4 ? 18 : 12;
      reasons.push({
        code: "NON_ELITE_TE_TOO_EARLY",
        label: "TE too early",
        detail:
          "Non-elite TE should usually wait until the round-six starter deadline.",
      });
    }
    reasons.push({
      code: "ONESIE_WAIT",
      label: "TE wait",
      detail:
        positionalRank == null
          ? "Non-elite TE can usually wait while RB/WR/FLEX value remains."
          : `TE${positionalRank} is not an elite TE window; compare RB/WR/FLEX first.`,
    });
  } else if (
    position === "TE" &&
    (requirements.TE ?? 0) <= 1 &&
    (needs.TE ?? 0) > 0 &&
    !isEliteTeStarter &&
    topSixStarterWindow
  ) {
    score += 26;
  } else if (
    position === "TE" &&
    (requirements.TE ?? 0) <= 1 &&
    (needs.TE ?? 0) > 0 &&
    !isEliteTeStarter &&
    teDeadlineWindow
  ) {
    score += currentRound >= 7 ? 58 : 20;
    reasons.push({
      code: "STARTER_DEADLINE",
      label: "TE deadline",
      detail: "TE starter is still open; fill it before the remaining starter tier gets thin.",
    });
  }

  return {
    score: roundOne(score),
    qbEarlyScore: roundOne(qbEarlyScore),
    teEarlyScore: roundOne(teEarlyScore),
    reasons,
  };
}

function qbStarterQualityPolicy(args: {
  position: Position;
  currentRound: number;
  needs: Partial<Record<RosterSlot, number>>;
  requirements: Partial<Record<RosterSlot, number>>;
  positionalRank: number | null;
  staticValue: number | null;
  isQbPreAdpReach: boolean;
  nonQbCoreStarterNeeds: number;
}): {
  isViable: boolean;
  isPreferred: boolean;
  isLowCeiling: boolean;
  score: number;
  timingUrgency: number;
  reasons: DraftValueReason[];
} {
  if (
    args.position !== "QB" ||
    (args.needs.QB ?? 0) <= 0 ||
    (args.requirements.QB ?? 0) > 1
  ) {
    return {
      isViable: false,
      isPreferred: false,
      isLowCeiling: false,
      score: 0,
      timingUrgency: 0,
      reasons: [],
    };
  }

  const isViable =
    (args.positionalRank != null && args.positionalRank <= 10) ||
    (args.staticValue != null && args.staticValue >= 85);
  const isPreferred =
    (args.positionalRank != null && args.positionalRank <= 8) ||
    (args.staticValue != null && args.staticValue >= 110);
  const isLowCeiling =
    (args.positionalRank != null && args.positionalRank >= 18) ||
    (args.staticValue != null && args.staticValue < 0);
  const reasons: DraftValueReason[] = [];
  let score = 0;
  let timingUrgency = 0;

  if (isLowCeiling) {
    score -= args.currentRound >= 12 ? 12 : 34;
    reasons.push({
      code: "QB_LOW_CEILING",
      label: "QB floor",
      detail:
        "This QB is below the usable starter floor; prefer real RB/WR value until the endgame.",
    });
  } else if (isViable && !args.isQbPreAdpReach) {
    if (args.currentRound >= 9) {
      score += isPreferred ? 22 : 16;
    } else if (
      args.currentRound >= 7 &&
      args.currentRound <= 8 &&
      args.nonQbCoreStarterNeeds <= 0
    ) {
      score += isPreferred ? 62 : 44;
    } else if (
      args.currentRound >= 7 &&
      args.currentRound <= 8 &&
      args.nonQbCoreStarterNeeds <= 1
    ) {
      score += isPreferred ? 28 : 20;
    } else if (
      args.currentRound >= 6 &&
      args.currentRound <= 8 &&
      args.nonQbCoreStarterNeeds <= 1
    ) {
      score += isPreferred ? 18 : 12;
    }

    if (score > 0) {
      reasons.push({
        code: "QB_VIABLE_STARTER",
        label: "QB floor",
        detail:
          "This QB still clears the usable starter floor; compare before the tier disappears.",
      });
    }
  }

  if (!args.isQbPreAdpReach && args.nonQbCoreStarterNeeds <= 0) {
    if (isLowCeiling) {
      timingUrgency += args.currentRound >= 12 ? 6 : args.currentRound >= 10 ? -18 : 0;
    } else if (isViable) {
      timingUrgency +=
        args.currentRound >= 12
          ? 54
          : args.currentRound >= 10
            ? 50
            : args.currentRound >= 9
            ? 42
            : args.currentRound >= 8
              ? 34
              : args.currentRound >= 7
                ? 44
                : 0;
    } else {
      timingUrgency += args.currentRound >= 12 ? 8 : 0;
    }
  }

  return {
    isViable,
    isPreferred,
    isLowCeiling,
    score: roundOne(score),
    timingUrgency: roundOne(timingUrgency),
    reasons,
  };
}

function eliteQbScore(args: {
  isEliteQbStarter: boolean;
  currentRound: number;
  positionCounts: Partial<Record<Position | "FLEX" | "BN", number>>;
  needs: Partial<Record<RosterSlot, number>>;
  positionalRank: number | null;
}) {
  if (!args.isEliteQbStarter) return 0;
  const rb2StillOpen =
    (args.positionCounts.RB ?? 0) === 1 &&
    (args.positionCounts.WR ?? 0) >= 2 &&
    (args.needs.RB ?? 0) > 0;
  const wr2StillOpen =
    (args.positionCounts.WR ?? 0) === 1 &&
    (args.positionCounts.RB ?? 0) >= 2 &&
    (args.needs.WR ?? 0) > 0;
  if (args.currentRound >= 5 && args.currentRound <= 6) {
    if (rb2StillOpen) {
      return 0;
    }
    if (wr2StillOpen) {
      return 0;
    }
    if (
      (args.positionCounts.RB ?? 0) >= 2 &&
      (args.positionCounts.TE ?? 0) >= 1
    ) {
      return 92;
    }
    return 36;
  }

  return 4;
}

function roomDemandScore(args: {
  position: Position;
  teams: number;
  draftWideNeeds?: Partial<Record<Position | "FLEX", number>> | undefined;
}) {
  const direct = args.draftWideNeeds?.[args.position];
  if (direct == null) return 0;
  const flexDemand = isFlexPosition(args.position)
    ? args.draftWideNeeds?.FLEX ?? 0
    : 0;
  const weightedDemand = direct + flexDemand * 0.4;
  if (weightedDemand >= args.teams * 0.5) return 1.5;
  if (
    weightedDemand <= 1 &&
    (args.position === "QB" ||
      args.position === "TE" ||
      args.position === "K" ||
      args.position === "DEF")
  ) {
    return -1.5;
  }
  if (weightedDemand <= Math.max(1, args.teams * 0.2)) return -0.5;
  return 0;
}

function isFlexPosition(position: Position): position is (typeof FLEX_POSITIONS)[number] {
  return position === "RB" || position === "WR" || position === "TE";
}

function sourceConfidence(missingFields: string[]): DraftSourceConfidence {
  if (missingFields.length === 0) return "high";
  if (missingFields.includes("ecr")) return "low";
  return "medium";
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundProbability(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizedComponent(value: number) {
  return roundOne(Math.max(-100, Math.min(100, value)));
}

function sumComponents(components: DraftRecommendationComponents) {
  return roundOne(
    COMPONENT_KEYS.reduce((total, key) => total + components[key], 0)
  );
}

function topRecommendationComponents(
  components: DraftRecommendationComponents
): DraftRecommendationComponent[] {
  const entries = COMPONENT_KEYS.map((key) => ({
    key,
    label: COMPONENT_LABELS[key],
    value: roundOne(components[key]),
  }));
  const positives = entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const negatives = entries
    .filter((entry) => entry.value < 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 1);
  return [...positives, ...negatives];
}

function uniqueStrings(values: readonly (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function formatPlayerReference(player: DraftValuePlayerInput) {
  return `${player.name ?? "Player"} (${player.position})`;
}

function scoreEdgeLabel(scoreGap: number | null): DraftRecommendationEdgeLabel {
  if (scoreGap == null) return "Only option";
  if (scoreGap <= 2) return "Coin flip";
  if (scoreGap <= 8) return "Slight edge";
  if (scoreGap <= 15) return "Clear edge";
  return "Big edge";
}

function buildEdgeDetail(args: {
  label: DraftRecommendationEdgeLabel;
  player: DraftValuePlayerInput;
  nextPlayer: DraftValuePlayerInput | null;
}) {
  if (!args.nextPlayer) return "Only ranked option in this view.";

  const tier = getTier(args.player);
  const nextTier = getTier(args.nextPlayer);
  const nextRef = formatPlayerReference(args.nextPlayer);
  if (tier != null && nextTier != null) {
    if (tier < nextTier) return `${args.label}; higher tier than ${nextRef}.`;
    if (tier === nextTier) return `${args.label} inside the same tier as ${nextRef}.`;
    return `${args.label}, but lower tier than ${nextRef}; roster fit or timing is carrying this pick.`;
  }
  return `${args.label} over ${nextRef}.`;
}

function formatRoundCount(value: number) {
  const rounded = Math.max(1, Math.round(Math.abs(value)));
  return `${rounded} round${rounded === 1 ? "" : "s"}`;
}

function adpText(adpDeltaRounds: number | null) {
  if (adpDeltaRounds == null) return null;
  if (adpDeltaRounds <= -0.75) {
    return { type: "pro" as const, text: `${formatRoundCount(adpDeltaRounds)} after ADP.` };
  }
  if (adpDeltaRounds < 0.75) {
    return { type: "pro" as const, text: "Near ADP." };
  }
  return { type: "con" as const, text: `${formatRoundCount(adpDeltaRounds)} before ADP.` };
}

function adpScore(adpDeltaRounds: number | null) {
  if (adpDeltaRounds == null) return 0;
  if (adpDeltaRounds <= -0.75) return 3;
  if (adpDeltaRounds >= 1.5) return -10;
  if (adpDeltaRounds >= 0.75) return -5;
  return 0;
}

function rosterNeedText(args: {
  position: Position;
  needs: Partial<Record<RosterSlot, number>>;
}) {
  if ((args.needs[args.position] ?? 0) > 0) {
    return `You need to fill ${args.position}.`;
  }
  if (isFlexPosition(args.position) && (args.needs.FLEX ?? 0) > 0) {
    return "Can fill FLEX.";
  }
  return null;
}

function tierTimingText(args: {
  position: Position;
  tier: number | null;
  comebackLabel: DraftComebackLabel;
  sameTierFallbackCount: number;
}) {
  if (args.tier != null && args.sameTierFallbackCount <= 1) {
    return `Likely last pick to get Tier ${args.tier} ${args.position}.`;
  }
  if (args.comebackLabel === "unlikely") {
    return "Likely gone before your next pick.";
  }
  if (args.comebackLabel === "likely") {
    return "Can probably wait based on ADP.";
  }
  return null;
}

function benchBalanceText(args: {
  position: Position;
  benchBalance: DraftBenchBalance;
}) {
  if (args.position !== "RB" && args.position !== "WR") return null;
  if (args.benchBalance.targetPosition == null) return null;
  if (args.benchBalance.targetPosition === args.position) {
    return {
      type: "pro" as const,
      text:
        args.benchBalance.status === "action"
          ? `Improves RB/WR ratio; need more ${args.position}.`
          : `Improves RB/WR ratio.`,
    };
  }
  if (args.benchBalance.status === "action") {
    return {
      type: "con" as const,
      text: `Need more ${args.benchBalance.targetPosition} depth.`,
    };
  }
  return null;
}

function byeCoverageText(args: {
  player: DraftValuePlayerInput;
  rosterPlayers: readonly DraftRosterPlayerInput[];
}) {
  if (args.player.bye_week == null) return null;
  const bye = String(args.player.bye_week);
  if (!bye || bye === "0") return null;
  const samePosition = args.rosterPlayers.find(
    (player) =>
      player.position === args.player.position && String(player.bye_week ?? "") === bye
  );
  if (samePosition) {
    return `Same Week ${bye} bye as ${samePosition.name ?? "another player"} (${samePosition.position}).`;
  }
  if (isFlexPosition(args.player.position)) {
    const sameFlexByeCount = args.rosterPlayers.filter(
      (player) => isFlexPosition(player.position) && String(player.bye_week ?? "") === bye
    ).length;
    if (sameFlexByeCount >= 2) {
      return `Adds another RB/WR/TE with Week ${bye} bye.`;
    }
  }
  return null;
}

function dataQualityText(args: {
  missingFields: readonly string[];
  injuryRisk: { penalty: number; status: string | null; notes: string | null };
}) {
  return uniqueStrings([
    args.missingFields.includes("ecr") ? "FantasyPros ECR average missing." : null,
    args.missingFields.includes("position rank") ? "FantasyPros position rank missing." : null,
    args.missingFields.includes("adp") ? "ADP missing." : null,
    args.missingFields.includes("tier") ? "Tier missing." : null,
    args.injuryRisk.penalty > 0
      ? `Injury/news flag: ${args.injuryRisk.status ?? "check player news"}.`
      : null,
  ]);
}

function buildRecommendationExplanation(args: {
  player: DraftValuePlayerInput;
  actionLabel: DraftActionLabel;
  adpDeltaRounds: number | null;
  comebackLabel: DraftComebackLabel;
  currentRound: number;
  needs: Partial<Record<RosterSlot, number>>;
  counts: Partial<Record<Position | "FLEX" | "BN", number>>;
  tier: number | null;
  sameTierFallbackCount: number;
  benchBalance: DraftBenchBalance;
  rosterPlayers: readonly DraftRosterPlayerInput[];
  missingFields: readonly string[];
  injuryRisk: { penalty: number; status: string | null; notes: string | null };
}) {
  const pros: string[] = [];
  const cons: string[] = [];

  const rosterNeed = rosterNeedText({
    position: args.player.position,
    needs: args.needs,
  });
  if (rosterNeed) pros.push(rosterNeed);

  const tierTiming = tierTimingText({
    position: args.player.position,
    tier: args.tier,
    comebackLabel: args.comebackLabel,
    sameTierFallbackCount: args.sameTierFallbackCount,
  });
  if (tierTiming) {
    if (tierTiming.startsWith("Can probably wait")) cons.push(tierTiming);
    else pros.push(tierTiming);
  }

  const balance = benchBalanceText({
    position: args.player.position,
    benchBalance: args.benchBalance,
  });
  if (balance?.type === "pro") pros.push(balance.text);
  if (balance?.type === "con") cons.push(balance.text);

  const rb = args.counts.RB ?? 0;
  const wr = args.counts.WR ?? 0;
  const te = args.counts.TE ?? 0;
  if (rb === 0 && wr >= 1 && (args.needs.RB ?? 0) > 0) {
    if (args.player.position === "RB") {
      pros.push(
        wr >= 2
          ? "Fills first RB after WR-heavy start."
          : "Fills first RB after opening WR."
      );
    } else if (
      args.player.position === "WR" ||
      args.player.position === "QB" ||
      args.player.position === "TE"
    ) {
      cons.push("RB starter is still empty.");
    }
  }
  if (
    rb === 1 &&
    wr >= 1 &&
    te >= 1 &&
    (args.needs.RB ?? 0) > 0 &&
    args.currentRound <= 5
  ) {
    if (args.player.position === "RB") {
      pros.push("Fills RB2 before the starter tier gets thin.");
    } else if (
      args.player.position === "WR" ||
      args.player.position === "QB" ||
      args.player.position === "TE"
    ) {
      cons.push("RB2 is still empty.");
    }
  }
  if (args.player.position === "RB" && rb >= 2 && wr === 0 && (args.needs.WR ?? 0) > 0) {
    cons.push("Leaves WR starter spots empty.");
  } else if (
    args.player.position === "RB" &&
    rb >= 1 &&
    wr === 0 &&
    (args.needs.WR ?? 0) > 0
  ) {
    cons.push("WR starter is still empty.");
  } else if (
    args.player.position === "RB" &&
    rb >= 2 &&
    wr === 1 &&
    (args.needs.WR ?? 0) > 0
  ) {
    cons.push("WR2 is still empty.");
  }
  if (args.player.position === "WR" && rb > wr && (args.needs.WR ?? 0) > 0) {
    pros.push("Improves RB/WR ratio.");
  }

  if (args.player.position === "K" || args.player.position === "DEF") {
    if (args.actionLabel !== "can wait") {
      pros.push(`End of draft is fine for ${args.player.position}.`);
    }
  }

  const adp = adpText(args.adpDeltaRounds);
  if (adp?.type === "pro") pros.push(adp.text);
  if (adp?.type === "con") cons.push(adp.text);

  const bye = byeCoverageText({
    player: args.player,
    rosterPlayers: args.rosterPlayers,
  });
  if (bye) cons.push(bye);

  const dataQuality = dataQualityText({
    missingFields: args.missingFields,
    injuryRisk: args.injuryRisk,
  });

  return {
    edge: {
      label: "Only option",
      detail: "Only ranked option in this view.",
    },
    pros: uniqueStrings(pros),
    cons: uniqueStrings(cons),
    dataQuality,
  } satisfies DraftRecommendationExplanation;
}

function summarizeRecommendationExplanation(
  explanation: DraftRecommendationExplanation
) {
  const parts = [
    explanation.edge.detail,
    ...explanation.pros.slice(0, 2),
    ...explanation.cons.slice(0, 1),
  ].filter(Boolean);
  return parts.join(" ");
}

function weightedComponent(
  rawScores: DraftRecommendationComponents,
  weights: DraftRecommendationWeights,
  key: DraftRecommendationComponentKey
) {
  return roundOne(rawScores[key] * weights[key]);
}

function weightRecommendationComponents(
  rawScores: DraftRecommendationComponents,
  weights: DraftRecommendationWeights
): DraftRecommendationComponents {
  return {
    value: weightedComponent(rawScores, weights, "value"),
    timing: weightedComponent(rawScores, weights, "timing"),
    starterNeed: weightedComponent(rawScores, weights, "starterNeed"),
    construction: weightedComponent(rawScores, weights, "construction"),
    onesie: weightedComponent(rawScores, weights, "onesie"),
    depth: weightedComponent(rawScores, weights, "depth"),
    demand: weightedComponent(rawScores, weights, "demand"),
    risk: weightedComponent(rawScores, weights, "risk"),
  };
}

function selectRecommendationWeightProfile(args: {
  currentRound: number;
  rounds?: number | undefined;
  needs: Partial<Record<RosterSlot, number>>;
}): DraftRecommendationWeightProfile {
  const coreNeeds =
    (args.needs.RB ?? 0) +
    (args.needs.WR ?? 0) +
    (args.needs.FLEX ?? 0);
  const starterNeeds =
    coreNeeds + (args.needs.QB ?? 0) + (args.needs.TE ?? 0);
  const specialNeeds = (args.needs.K ?? 0) + (args.needs.DEF ?? 0);
  const finalTwoRounds =
    args.rounds != null && args.currentRound >= Math.max(1, args.rounds - 1);

  if (finalTwoRounds && specialNeeds > 0) {
    return RECOMMENDATION_WEIGHT_PROFILES.endgame;
  }
  if (coreNeeds > 0) {
    return args.currentRound <= 6
      ? RECOMMENDATION_WEIGHT_PROFILES.starter_build
      : RECOMMENDATION_WEIGHT_PROFILES.core_balance;
  }
  if (starterNeeds > 0) {
    return RECOMMENDATION_WEIGHT_PROFILES.core_balance;
  }
  return RECOMMENDATION_WEIGHT_PROFILES.depth_build;
}

function recommendationConfidence(args: {
  scoreGap: number | null;
  sourceConfidence: DraftSourceConfidence;
  missingFields: readonly string[];
  injuryPenalty: number;
}): DraftRecommendationConfidence {
  if (
    args.scoreGap != null &&
    args.scoreGap >= 12 &&
    args.sourceConfidence === "high" &&
    args.injuryPenalty === 0
  ) {
    return "high";
  }
  if (
    args.scoreGap != null &&
    args.scoreGap >= 5 &&
    args.sourceConfidence !== "low" &&
    args.missingFields.length <= 1
  ) {
    return "medium";
  }
  return "low";
}

export function buildDraftValueBoard<TPlayer extends DraftValuePlayerInput>(
  input: DraftValueBoardInput<TPlayer>
): DraftValueBoard<TPlayer> {
  const teams = Math.max(1, input.teams || 1);
  const currentPick = Math.max(1, input.currentPick || 1);
  const available = input.players.filter((player) => !isPicked(player));
  const starters = countRequiredStarters(teams, input.rosterRequirements);
  const nextPick = getNextPickForSlot({
    currentPick,
    userSlot: input.userSlot,
    teams,
    rounds: input.rounds,
    draftType: input.draftType,
  });
  const comebackTargetPick = getNextPickForSlot({
    currentPick: currentPick + 1,
    userSlot: input.userSlot,
    teams,
    rounds: input.rounds,
    draftType: input.draftType,
  });
  const picksUntilNextTurn =
    nextPick == null ? null : Math.max(0, nextPick - currentPick);

  const byPosition = new Map<Position, TPlayer[]>();
  for (const position of CORE_POSITIONS) byPosition.set(position, []);
  for (const player of available) {
    byPosition.get(player.position)?.push(player);
  }

  const lastRecentPicks = input.players
    .filter((player) => {
      const picked = player.picked;
      return picked && typeof picked === "object" && picked.overall != null;
    })
    .sort((a, b) => {
      const aOverall = pickedOverall(a);
      const bOverall = pickedOverall(b);
      return bOverall - aOverall;
    })
    .slice(0, Math.min(teams, 10));

  const runCounts = new Map<Position, number>();
  for (const player of lastRecentPicks) {
    runCounts.set(player.position, (runCounts.get(player.position) ?? 0) + 1);
  }

  const rosterConstruction = inferRosterConstruction({
    counts: input.userPositionCounts,
    needs: input.userPositionNeeds,
    requirements: input.rosterRequirements,
    players: input.userRosterPlayers,
  });
  const currentRound = teams > 0 ? Math.ceil(currentPick / teams) : 1;
  const weightProfile = selectRecommendationWeightProfile({
    currentRound,
    rounds: input.rounds,
    needs: input.userPositionNeeds,
  });

  const valueSeed = available.map((player) => {
    const rankValue = rankBasedValueScore({
      player,
      starters,
      teams,
    });
    return { player, staticValue: rankValue.score, rankValue };
  });

  const valueRanks = [...valueSeed]
    .sort((a, b) => (b.staticValue ?? -Infinity) - (a.staticValue ?? -Infinity))
    .map((entry, index) => [entry.player.player_id, index + 1] as const);
  const valueRankByPlayer = new Map(valueRanks);

  const metricsEntries = valueSeed.map((entry): [string, DraftValueMetrics] => {
    const { player, staticValue, rankValue } = entry;
    const injuryRisk = getInjuryRisk(player);
    const samePosition = byPosition.get(player.position) ?? [];
    const tier = getTier(player);
    const positionTier = getPositionTier(player);
    const scarcityTier = positionTier;
    const sameTierFallbackCount =
      scarcityTier == null
        ? 0
        : samePosition.filter(
            (candidate) =>
              candidate.player_id !== player.player_id &&
              getPositionTier(candidate) === scarcityTier &&
              !isPicked(candidate)
          ).length;
    const sortedPosition = [...samePosition].sort((a, b) => {
      const ar = getFpPositionRank(a) ?? 999_999;
      const br = getFpPositionRank(b) ?? 999_999;
      return ar - br;
    });
    const playerIndex = sortedPosition.findIndex(
      (candidate) => candidate.player_id === player.player_id
    );
    const nextTierPlayer = sortedPosition
      .slice(Math.max(0, playerIndex + 1))
      .find((candidate) => getPositionTier(candidate) !== scarcityTier);
    const playerRankForCliff = getFpPositionRank(player);
    const nextTierRank = nextTierPlayer
      ? getFpPositionRank(nextTierPlayer)
      : null;
    const tierCliff =
      playerRankForCliff != null && nextTierRank != null
        ? Math.max(0, nextTierRank - playerRankForCliff)
        : sameTierFallbackCount <= 1
        ? 1
        : 0;
    const adp = getAdp(player);
    const adpDeltaPicks = adp == null ? null : roundOne(adp - currentPick);
    const adpDeltaRounds =
      adpDeltaPicks == null ? null : roundOne(adpDeltaPicks / teams);
    const availability = adjustedComebackProbability({
      adp,
      position: player.position,
      currentPick,
      nextPick,
      comebackTargetPick,
      teams,
      draftType: input.draftType,
      teamRosterStates: input.teamRosterStates,
    });
    const label = comebackLabel(availability);
    const positionRunCount = runCounts.get(player.position) ?? 0;
    const runUrgency = positionRunCount >= 3 ? 2 : positionRunCount >= 2 ? 1 : 0;
    const cliffUrgency =
      sameTierFallbackCount <= 1 ? 2 : sameTierFallbackCount <= 3 ? 1 : 0;
    const availabilityUrgency =
      availability == null ? 0 : Math.max(0, roundOne((1 - availability) * 8));
    const roomDemand = roomDemandScore({
      position: player.position,
      teams,
      draftWideNeeds: input.draftWideNeeds,
    });
    const urgencyScore = roundOne(
      availabilityUrgency + runUrgency + cliffUrgency + roomDemand
    );
    const fit = roundOne(
      rosterFitScore({
        position: player.position,
        currentPick,
        rounds: input.rounds,
        teams,
        needs: input.userPositionNeeds,
        counts: input.userPositionCounts,
      })
    );
    const positionalRank = rankValue.positionRank;
    const starterFragility =
      (player.position === "RB" || player.position === "WR") &&
      (input.userPositionNeeds[player.position] ?? 0) > 0 &&
      positionalRank != null
        ? Math.max(
            0,
            (positionalRank -
              teams *
                Math.max(1, input.rosterRequirements[player.position] ?? 1) *
                0.65) *
              2
          )
        : 0;
    const bench = benchPolicy({
      position: player.position,
      currentPick,
      rounds: input.rounds,
      teams,
      needs: input.userPositionNeeds,
      counts: input.userPositionCounts,
      requirements: input.rosterRequirements,
      benchBalance: rosterConstruction.benchBalance,
    });
    const rbAnchor = rbAnchorPolicy({
      position: player.position,
      currentRound,
      needs: input.userPositionNeeds,
      counts: input.userPositionCounts,
    });
    const missingFields = [
      rankValue.overallRank == null ? "ecr" : null,
      rankValue.positionRank == null ? "position rank" : null,
      adp == null ? "adp" : null,
      tier == null ? "tier" : null,
    ].filter((value): value is string => value != null);
    const confidence = sourceConfidence(missingFields);
    const ecrDeltaPicks =
      rankValue.overallRank == null
        ? null
        : roundOne(rankValue.overallRank - currentPick);
    const isEarlyOnesieEcrReach =
      (player.position === "QB" || player.position === "TE") &&
      currentRound <= 6 &&
      ecrDeltaPicks != null &&
      ecrDeltaPicks > 0;
    const isQbPreAdpReach =
      player.position === "QB" &&
      adpDeltaPicks != null &&
      adpDeltaPicks >= teams / 2;
    const nonQbCoreStarterNeeds =
      (input.userPositionNeeds.RB ?? 0) +
      (input.userPositionNeeds.WR ?? 0) +
      (input.userPositionNeeds.TE ?? 0);
    const qbStarterQuality = qbStarterQualityPolicy({
      position: player.position,
      currentRound,
      needs: input.userPositionNeeds,
      requirements: input.rosterRequirements,
      positionalRank,
      staticValue,
      isQbPreAdpReach,
      nonQbCoreStarterNeeds,
    });
    const eliteQbStarter =
      player.position === "QB" &&
      (input.userPositionNeeds.QB ?? 0) > 0 &&
      (input.rosterRequirements.QB ?? 0) <= 1 &&
      positionTier === 1 &&
      !isQbPreAdpReach;
    const eliteTeStarter =
      player.position === "TE" &&
      (input.userPositionNeeds.TE ?? 0) > 0 &&
      (input.rosterRequirements.TE ?? 0) <= 1 &&
      positionTier === 1 &&
      positionalRank != null &&
      positionalRank <= 2;
    const onesieStarter = onesieStarterPolicy({
      position: player.position,
      currentPick,
      teams,
      needs: input.userPositionNeeds,
      requirements: input.rosterRequirements,
      positionalRank,
      isEliteQbStarter: eliteQbStarter,
      isEliteTeStarter: eliteTeStarter,
      isViableQbStarter: qbStarterQuality.isViable,
      isLowCeilingQbStarter: qbStarterQuality.isLowCeiling,
      isQbPreAdpReach,
      adpDeltaPicks,
    });
    const wrStarterWindow =
      player.position === "WR" &&
      (input.userPositionCounts.WR ?? 0) <
        Math.max(3, input.rosterRequirements.WR ?? 0) &&
      ((input.userPositionNeeds.WR ?? 0) > 0 ||
        ((input.userPositionNeeds.FLEX ?? 0) > 0 && currentRound <= 8)) &&
      (label === "unlikely" ||
        sameTierFallbackCount <= 2 ||
        (positionalRank != null && positionalRank <= 36));
    const wr2AnchorWindow =
      wrStarterWindow &&
      (input.userPositionCounts.WR ?? 0) === 1 &&
      currentRound <= 6 &&
      (label !== "likely" ||
        sameTierFallbackCount <= 1 ||
        (positionalRank != null && positionalRank <= 24));
    const wr2DeadlineWindow =
      wrStarterWindow &&
      (input.userPositionCounts.WR ?? 0) === 1 &&
      (input.userPositionNeeds.WR ?? 0) > 0 &&
      currentRound >= 4 &&
      currentRound <= 5;
    const wrStarterScore = wrStarterWindow
      ? (input.userPositionCounts.WR ?? 0) === 0 && currentRound <= 3
        ? 0
        : wr2DeadlineWindow
          ? 18
          : 6
      : 0;
    const lateQbStarterUrgency =
      player.position === "QB" &&
      (input.userPositionNeeds.QB ?? 0) > 0 &&
      (input.rosterRequirements.QB ?? 0) <= 1 &&
      currentRound >= 7
        ? qbStarterQuality.timingUrgency ||
          (qbStarterQuality.isViable &&
          isQbPreAdpReach &&
          nonQbCoreStarterNeeds <= 0 &&
          adpDeltaPicks != null &&
          adpDeltaPicks <= teams &&
          currentRound >= 9
            ? currentRound >= 10
              ? 44
              : 35
            : 0)
        : 0;
    const rank = valueRankByPlayer.get(player.player_id) ?? null;
    const eliteTeScore =
      eliteTeStarter && !isEarlyOnesieEcrReach
        ? currentRound >= 3 && currentRound <= 4
          ? 102
          : currentRound >= 5
            ? 64
            : 12
        : 0;
    const eliteQbComponentScore = eliteQbScore({
      isEliteQbStarter: eliteQbStarter && !isEarlyOnesieEcrReach,
      currentRound,
      positionCounts: input.userPositionCounts,
      needs: input.userPositionNeeds,
      positionalRank,
    });
    const onesieSignal =
      onesieStarter.score +
      eliteQbComponentScore +
      eliteTeScore +
      onesieStarter.qbEarlyScore +
      onesieStarter.teEarlyScore +
      qbStarterQuality.score +
      (isEarlyOnesieEcrReach
        ? -Math.min(60, 24 + (ecrDeltaPicks ?? 0) * 2)
        : 0) +
      (isQbPreAdpReach ? (currentRound >= 9 ? -6 : -30) : 0) +
      lateQbStarterUrgency;
    const rawScores: DraftRecommendationComponents = {
      value: normalizedComponent((staticValue ?? 0) / 2),
      timing: normalizedComponent(
        (availabilityUrgency +
          runUrgency +
          cliffUrgency +
          Math.min(tierCliff ?? 0, 20) * 0.2 +
          adpScore(adpDeltaRounds)) *
          2
      ),
      starterNeed: normalizedComponent(fit * 4 + starterFragility),
      construction: normalizedComponent(
        rbAnchor.score +
          wrStarterScore +
          (wr2AnchorWindow ? (wr2DeadlineWindow ? 24 : 13) : 0)
      ),
      onesie: normalizedComponent(
        onesieSignal < 0 ? onesieSignal * 3 : onesieSignal
      ),
      depth: normalizedComponent(bench.score),
      demand: normalizedComponent(roomDemand * 12),
      risk: normalizedComponent(
        -missingFields.length * 12 - injuryRisk.penalty * 5
      ),
    };
    const components = weightRecommendationComponents(
      rawScores,
      weightProfile.weights
    );
    const recommendationScore = sumComponents(components);
    const topComponents = topRecommendationComponents(components);
    const actionLabel = buildActionLabel(
      availability,
      sameTierFallbackCount,
      urgencyScore
    );
    const reasons: DraftValueReason[] = [];
    if (rank != null && rank <= 8) {
      reasons.push({
        code: "BEST_VALUE",
        label: "Best value",
        detail: `Top-${rank} remaining value on the board.`,
      });
    }
    if (eliteQbStarter) {
      reasons.push({
        code: "ELITE_QB_STARTER",
        label: "Elite QB",
        detail:
          "Top-tier quarterbacks can create weekly separation; review if the RB/WR gap is not obvious.",
      });
    }
    if (eliteTeStarter) {
      reasons.push({
        code: "ELITE_TE_STARTER",
        label: "Elite TE",
        detail:
          "Top-tier tight ends can separate from the replacement TE pool; review before the tier closes.",
      });
    }
    if (isEarlyOnesieEcrReach) {
      reasons.push({
        code: "ONESIE_WAIT",
        label: "Wait for ECR",
        detail: `${player.position} is still ${ecrDeltaPicks} pick${ecrDeltaPicks === 1 ? "" : "s"} before FantasyPros ECR; keep building RB/WR until the price reaches consensus.`,
      });
    }
    if (wr2AnchorWindow) {
      reasons.push({
        code: "WR2_ANCHOR",
        label: "WR2 anchor",
        detail:
          "Only one trusted WR is rostered; review this WR before chasing RB depth or a merely good QB.",
      });
    }
    if (wrStarterWindow) {
      reasons.push({
        code: "WR_STARTER_WINDOW",
        label: "WR starter",
        detail:
          (input.userPositionCounts.WR ?? 0) === 0 && currentRound <= 3
            ? "First WR anchor is still open; take a close WR over another RB before the starter tier thins."
            : "WR starter and FLEX quality can fall quickly; compare before adding RB depth or a non-elite QB.",
      });
    }
    if (lateQbStarterUrgency > 0) {
      reasons.push({
        code: "QB_TIMING",
        label: "QB window",
        detail:
          currentRound >= 12
            ? "QB starter is still open late; take a usable option before K/DEF or another depth pick."
            : "QB starter is still open; start comparing viable options before the endgame.",
      });
    }
    reasons.push(...qbStarterQuality.reasons);
    if (sameTierFallbackCount <= 1 && scarcityTier != null) {
      reasons.push({
        code: "TIER_CLIFF",
        label: "Tier cliff",
        detail: `${sameTierFallbackCount} same-tier ${player.position} fallback${sameTierFallbackCount === 1 ? "" : "s"} left.`,
      });
    }
    if (label === "unlikely") {
      reasons.push({
        code: "LIKELY_GONE",
        label: "Likely gone",
        detail: "ADP timing says this player probably will not return.",
      });
    }
    if (adp != null && adp <= currentPick - teams / 2) {
      reasons.push({
        code: "ADP_BARGAIN",
        label: "ADP bargain",
        detail: `Still available ${roundOne((currentPick - adp) / teams)} rounds after market.`,
      });
    }
    if (fit >= 4) {
      reasons.push({
        code: "ROSTER_NEED",
        label: "Roster need",
        detail: `${player.position} fits an open starter or flex need.`,
      });
    }
    reasons.push(...onesieStarter.reasons);
    reasons.push(...rbAnchor.reasons);
    reasons.push(...bench.reasons);
    if (roomDemand >= 1) {
      const directNeeds = input.draftWideNeeds?.[player.position] ?? 0;
      reasons.push({
        code: "ROOM_DEMAND",
        label: "Room demand",
        detail: `${directNeeds} open ${player.position} needs remain across the room.`,
      });
    }
    if (injuryRisk.penalty > 0) {
      reasons.push({
        code: "NEWS_RISK",
        label: "News risk",
        detail: injuryRisk.notes
          ? `${injuryRisk.status ?? "Injury"}: ${injuryRisk.notes}`
          : `Sleeper injury status: ${injuryRisk.status ?? "flagged"}.`,
      });
    }
    const recommendationExplanation = buildRecommendationExplanation({
      player,
      actionLabel,
      adpDeltaRounds,
      comebackLabel: label,
      currentRound,
      needs: input.userPositionNeeds,
      counts: input.userPositionCounts,
      tier: scarcityTier,
      sameTierFallbackCount,
      benchBalance: rosterConstruction.benchBalance,
      rosterPlayers: input.userRosterPlayers ?? [],
      missingFields,
      injuryRisk,
    });

    return [
      player.player_id,
      {
        playerId: player.player_id,
        staticValue: staticValue == null ? null : roundOne(staticValue),
        recommendationScore,
        recommendationRank: null,
        valueRank: rank,
        positionalValueRank: positionalRank,
        positionTier,
        tierCliff: tierCliff == null ? null : roundOne(tierCliff),
        sameTierFallbackCount,
        sleeperAdp: adp == null ? null : roundOne(adp),
        adpDeltaPicks,
        adpDeltaRounds,
        comebackProbability:
          availability == null ? null : roundProbability(availability),
        comebackLabel: label,
        actionLabel,
        urgencyScore,
        rosterFitScore: fit,
        roomDemandScore: roomDemand,
        benchPolicyScore: bench.score,
        rawScores,
        weights: weightProfile.weights,
        weightProfile: weightProfile.id,
        weightProfileLabel: weightProfile.label,
        components,
        topComponents,
        recommendationExplanation,
        recommendationSummary: summarizeRecommendationExplanation(
          recommendationExplanation
        ),
        recommendationConfidence: null,
        recommendationScoreGap: null,
        positionRunCount,
        sourceConfidence: confidence,
        missingFields,
        reasons,
      },
    ];
  });

  const metricsByPlayerId = Object.fromEntries(metricsEntries);
  const recommendations = available
    .filter(
      (player) => metricsByPlayerId[player.player_id]?.staticValue != null
    )
    .sort((a, b) => {
    const am = metricsByPlayerId[a.player_id];
    const bm = metricsByPlayerId[b.player_id];
    return (bm?.recommendationScore ?? -Infinity) - (am?.recommendationScore ?? -Infinity);
    });

  recommendations.forEach((player, index) => {
    const metric = metricsByPlayerId[player.player_id];
    if (!metric) return;
    const nextPlayer = recommendations[index + 1] ?? null;
    const nextMetric = nextPlayer
      ? metricsByPlayerId[nextPlayer.player_id]
      : null;
    const scoreGap =
      nextMetric == null
        ? null
        : roundOne(metric.recommendationScore - nextMetric.recommendationScore);
    const edgeLabel = scoreEdgeLabel(scoreGap);

    metric.recommendationRank = index + 1;
    metric.recommendationScoreGap = scoreGap;
    metric.recommendationConfidence = recommendationConfidence({
      scoreGap,
      sourceConfidence: metric.sourceConfidence,
      missingFields: metric.missingFields,
      injuryPenalty: Math.abs(metric.components.risk),
    });
    metric.recommendationExplanation = {
      ...metric.recommendationExplanation,
      edge: {
        label: edgeLabel,
        detail: buildEdgeDetail({
          label: edgeLabel,
          player,
          nextPlayer,
        }),
      },
    };
    metric.recommendationSummary = summarizeRecommendationExplanation(
      metric.recommendationExplanation
    );
  });

  const topPlayer = recommendations[0] ?? null;
  const topMetric = topPlayer ? metricsByPlayerId[topPlayer.player_id] : null;
  const topRecommendation =
    topPlayer && topMetric
      ? {
          player: topPlayer,
          metrics: topMetric,
          challengers: recommendations.slice(1, 4).flatMap((player) => {
            const metric = metricsByPlayerId[player.player_id];
            if (!metric) return [];
            return [
              {
                playerId: player.player_id,
                score: metric.recommendationScore,
                scoreGap: roundOne(
                  topMetric.recommendationScore - metric.recommendationScore
                ),
              },
            ];
          }),
        }
      : null;

  return {
    metricsByPlayerId,
    recommendations,
    topRecommendation,
    nextPick,
    picksUntilNextTurn,
    rosterConstruction,
  };
}

function pickedOverall(player: DraftValuePlayerInput) {
  const picked = player.picked;
  if (!picked || typeof picked !== "object") return 0;
  return toNumber(picked.overall) ?? 0;
}

export function attachDraftValueMetrics<TPlayer extends DraftValuePlayerInput>(
  player: TPlayer,
  metrics: DraftValueMetrics | undefined
): TPlayer & {
  draft_value_score?: number | null;
  draft_tier_cliff?: number | null;
  draft_adp_delta_rounds?: number | null;
  draft_comeback_probability?: number | null;
  draft_comeback_label?: DraftComebackLabel;
  draft_action_label?: DraftActionLabel;
  draft_urgency?: number | null;
  draft_room_demand?: number | null;
  draft_bench_policy?: number | null;
  draft_raw_component_scores?: Partial<Record<DraftRecommendationComponentKey, number>>;
  draft_component_weights?: Partial<Record<DraftRecommendationComponentKey, number>>;
  draft_weight_profile?: DraftRecommendationWeightProfileId;
  draft_weight_profile_label?: string;
  draft_component_scores?: Partial<Record<DraftRecommendationComponentKey, number>>;
  draft_component_labels?: string[];
  draft_recommendation_edge?: DraftRecommendationEdgeLabel;
  draft_recommendation_edge_detail?: string;
  draft_recommendation_pros?: string[];
  draft_recommendation_cons?: string[];
  draft_data_quality_notes?: string[];
  draft_recommendation_summary?: string;
  draft_recommendation_confidence?: DraftRecommendationConfidence | null;
  draft_recommendation_score_gap?: number | null;
  draft_same_tier_fallbacks?: number | null;
  draft_roster_fit?: number | null;
  draft_source_confidence?: DraftSourceConfidence;
  draft_missing_fields?: string[];
  draft_reason_labels?: string[];
  draft_reason_details?: string[];
  draft_recommendation_rank?: number | null;
} {
  if (!metrics) return { ...player };
  return {
    ...player,
    draft_value_score: metrics.recommendationScore,
    draft_tier_cliff: metrics.tierCliff,
    draft_adp_delta_rounds: metrics.adpDeltaRounds,
    draft_comeback_probability: metrics.comebackProbability,
    draft_comeback_label: metrics.comebackLabel,
    draft_action_label: metrics.actionLabel,
    draft_urgency: metrics.urgencyScore,
    draft_room_demand: metrics.roomDemandScore,
    draft_bench_policy: metrics.benchPolicyScore,
    draft_raw_component_scores: metrics.rawScores,
    draft_component_weights: metrics.weights,
    draft_weight_profile: metrics.weightProfile,
    draft_weight_profile_label: metrics.weightProfileLabel,
    draft_component_scores: metrics.components,
    draft_component_labels: metrics.topComponents.map(
      (component) => `${component.label} ${component.value > 0 ? "+" : ""}${component.value}`
    ),
    draft_recommendation_edge: metrics.recommendationExplanation.edge.label,
    draft_recommendation_edge_detail:
      metrics.recommendationExplanation.edge.detail,
    draft_recommendation_pros: metrics.recommendationExplanation.pros,
    draft_recommendation_cons: metrics.recommendationExplanation.cons,
    draft_data_quality_notes: metrics.recommendationExplanation.dataQuality,
    draft_recommendation_summary: metrics.recommendationSummary,
    draft_recommendation_confidence: metrics.recommendationConfidence,
    draft_recommendation_score_gap: metrics.recommendationScoreGap,
    draft_same_tier_fallbacks: metrics.sameTierFallbackCount,
    draft_roster_fit: metrics.rosterFitScore,
    draft_source_confidence: metrics.sourceConfidence,
    draft_missing_fields: metrics.missingFields,
    draft_reason_labels: metrics.reasons.map((reason) => reason.label),
    draft_reason_details: metrics.reasons.map((reason) => reason.detail),
    draft_recommendation_rank: metrics.recommendationRank,
  };
}
