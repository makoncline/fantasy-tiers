import { buildDraftViewModel } from "@/lib/draftState";
import {
  attachDraftValueMetrics,
  type DraftValueMetrics,
} from "@/lib/draftValue";
import { draftCandidateMapFromBundle } from "@/lib/draftCandidate";
import { draftReadinessShardCountsFromBundle } from "@/lib/draftReadiness";
import { createMockDraftResultArtifact } from "@/lib/draftResults";
import type {
  AlgorithmDraftCandidate,
  AlgorithmDraftDecision,
} from "@/lib/draftDecisionLog";
import { createDraftSourceSnapshot } from "@/lib/draftDecisionLog.server";
import type { AggregatesBundleResponseT } from "@/lib/schemas-bundle";
import {
  advanceUntilUserTurn,
  createSimDraft,
  getRoundPick,
  getSimDraftSnapshot,
  makeUserPick,
  toSleeperDraftDetails,
  toSleeperDraftPicks,
  type SimDraftConfig,
  type SimDraftPlayer,
  type SimDraftState,
} from "@/lib/simDraft";
type DraftViewModel = ReturnType<typeof buildDraftViewModel>;
type RecommendationBoard = NonNullable<DraftViewModel["recommendationBoard"]>;
type RecommendationPlayer = RecommendationBoard["recommendations"][number];

export type AlgorithmMockDraftRun = {
  state: SimDraftState;
  artifact: ReturnType<typeof createMockDraftResultArtifact>;
  decisions: AlgorithmDraftDecision[];
};

export function runAlgorithmMockDraft(input: {
  config: SimDraftConfig;
  players: readonly SimDraftPlayer[];
  bundle: AggregatesBundleResponseT;
}): AlgorithmMockDraftRun {
  let state = advanceUntilUserTurn(createSimDraft(input.config), input.players);
  const decisions: AlgorithmDraftDecision[] = [];

  while (state.status !== "complete") {
    const snapshot = getSimDraftSnapshot(state, input.players);
    if (!snapshot.isUserTurn) {
      state = advanceUntilUserTurn(state, input.players);
      continue;
    }

    const decisionContext = buildAlgorithmDecisionContext({
      state,
      players: input.players,
      bundle: input.bundle,
    });
    const board = decisionContext.board;
    if (!board) {
      const incidents = decisionContext.viewModel.readiness?.incidents
        .map((incident) => incident.message)
        .join(" ");
      const playerIssues = decisionContext.viewModel.readiness?.playerIssues
        .slice(0, 3)
        .map((issue) => `${issue.name}: ${issue.problems.join(" ")}`)
        .join(" ");
      throw new Error(
        `Recommendation board unavailable at pick ${snapshot.currentPickNo}. ` +
          (incidents || "No readiness incident was reported.") +
          (playerIssues ? ` ${playerIssues}` : "")
      );
    }
    const topRecommendation = board.topRecommendation;
    if (!topRecommendation) {
      throw new Error(`No algorithm recommendation at pick ${snapshot.currentPickNo}`);
    }

    decisions.push(
      buildDecisionRecord({
        state,
        metricsByPlayerId: board.metricsByPlayerId,
        recommendations: board.recommendations,
        topRecommendation,
        viewModel: decisionContext.viewModel,
      })
    );
    state = makeUserPick(
      state,
      topRecommendation.player.player_id,
      input.players
    );
    state = advanceUntilUserTurn(state, input.players);
  }

  const finalDraftDetails = toSleeperDraftDetails(state);
  const finalDraftPicks = toSleeperDraftPicks(state);
  const finalSnapshot = getSimDraftSnapshot(state, input.players);
  const finalViewModel = buildDraftViewModel({
    playersMap: candidateMapForSimPlayers(input.bundle, input.players),
    draft: finalDraftDetails,
    picks: finalDraftPicks,
    userId: state.config.userId,
    topLimit: 4,
    scoringRules: state.config.scoringRules,
    projectionArtifact: input.bundle.draftProjections,
    sourceHealth: input.bundle.sourceHealth ?? null,
    shardCounts: draftReadinessShardCountsFromBundle(input.bundle),
  });
  const artifact = createMockDraftResultArtifact({
    state,
    snapshot: finalSnapshot,
    players: input.players,
    draftDetails: finalDraftDetails,
    draftPicks: finalDraftPicks,
    viewModel: finalViewModel,
    sourceHealth: input.bundle.sourceHealth,
    sourceSnapshot: createDraftSourceSnapshot({
      bundle: input.bundle,
      players: input.players,
    }),
    readiness: finalViewModel.readiness,
    notes: [
      "User slot picks were made automatically from draftValueBoard.topRecommendation.",
      `Algorithm decision count: ${decisions.length}.`,
    ],
  });

  return { state, artifact, decisions };
}

function buildAlgorithmDecisionContext(input: {
  state: SimDraftState;
  players: readonly SimDraftPlayer[];
  bundle: AggregatesBundleResponseT;
}) {
  const draftDetails = toSleeperDraftDetails(input.state);
  const draftPicks = toSleeperDraftPicks(input.state);
  const viewModel = buildDraftViewModel({
    playersMap: candidateMapForSimPlayers(input.bundle, input.players),
    draft: draftDetails,
    picks: draftPicks,
    userId: input.state.config.userId,
    topLimit: 4,
    scoringRules: input.state.config.scoringRules,
    projectionArtifact: input.bundle.draftProjections,
    sourceHealth: input.bundle.sourceHealth ?? null,
    shardCounts: draftReadinessShardCountsFromBundle(input.bundle),
  });
  const board = viewModel.recommendationBoard;

  return { board, viewModel };
}

function candidateMapForSimPlayers(
  bundle: AggregatesBundleResponseT,
  players: readonly SimDraftPlayer[]
) {
  const availableIds = new Set(players.map((player) => player.player_id));
  return Object.fromEntries(
    Object.entries(draftCandidateMapFromBundle(bundle)).filter(([playerId]) =>
      availableIds.has(playerId)
    )
  );
}

function buildDecisionRecord(input: {
  state: SimDraftState;
  metricsByPlayerId: Record<string, DraftValueMetrics>;
  recommendations: RecommendationPlayer[];
  topRecommendation: {
    player: RecommendationPlayer;
    metrics: DraftValueMetrics;
    challengers: { playerId: string; score: number; scoreGap: number }[];
  };
  viewModel: ReturnType<typeof buildDraftViewModel>;
}): AlgorithmDraftDecision {
  const pickNo = input.state.picks.length + 1;
  const { round, pickInRound } = getRoundPick(pickNo, input.state.config.teams);

  return {
    pickNo,
    round,
    pickInRound,
    userSlot: input.state.config.userSlot,
    selected: candidateFromMetrics(
      input.topRecommendation.player,
      input.topRecommendation.metrics
    ),
    topOptions: input.recommendations.slice(0, 30).flatMap((player) => {
      const metrics = input.metricsByPlayerId[player.player_id];
      return metrics ? [candidateFromMetrics(player, metrics)] : [];
    }),
    challengers: input.topRecommendation.challengers,
    rosterCountsBefore:
      input.viewModel.userRoster?.rosterPositionCounts ?? {},
    rosterNeedsBefore:
      input.viewModel.userRoster?.remainingPositionRequirements ?? {},
    availableCount: input.recommendations.length,
  };
}

function candidateFromMetrics(
  player: RecommendationPlayer,
  metrics: DraftValueMetrics
): AlgorithmDraftCandidate {
  if (metrics.recommendationRank == null) {
    throw new Error(
      `Recommendation ${player.player_id} is missing a recommendation rank`
    );
  }
  const attached = attachDraftValueMetrics(player, metrics);
  return {
    playerId: attached.player_id,
    name: attached.name,
    position: attached.position,
    team: attached.team,
    byeWeek:
      attached.bye_week == null || !Number.isFinite(Number(attached.bye_week))
        ? null
        : Number(attached.bye_week),
    recommendationRank: metrics.recommendationRank,
    recommendationScore: metrics.recommendationScore,
    recommendationEdge: metrics.recommendationExplanation.edge.label,
    recommendationEdgeDetail: metrics.recommendationExplanation.edge.detail,
    recommendationPros: metrics.recommendationExplanation.pros,
    recommendationCons: metrics.recommendationExplanation.cons,
    dataQualityNotes: metrics.recommendationExplanation.dataQuality,
    recommendationSummary: metrics.recommendationSummary,
    confidence: metrics.recommendationConfidence,
    scoreGap: metrics.recommendationScoreGap,
    staticValue: metrics.staticValue,
    valueRank: metrics.valueRank,
    positionalValueRank: metrics.positionalValueRank,
    positionTier: metrics.positionTier,
    comebackProbability: metrics.comebackProbability,
    comebackLabel: metrics.comebackLabel,
    weightProfile: metrics.weightProfile,
    topComponents: metrics.topComponents,
    reasonLabels: attached.draft_reason_labels ?? [],
    reasonDetails: attached.draft_reason_details ?? [],
  };
}
