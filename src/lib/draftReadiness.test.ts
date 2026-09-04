import { describe, expect, it } from "vitest";

import { buildAggregateBundle } from "@/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "@/lib/draftCandidate";
import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
  calculateDraftRounds,
  rankingScoringFromRules,
} from "@/lib/draftLeagueConfig";
import {
  assessDraftReadiness,
  draftReadinessShardCountsFromBundle,
} from "@/lib/draftReadiness";
import { normalizePlayerName } from "@/lib/util";

function currentAssessment() {
  const teams = 12;
  const rounds = calculateDraftRounds(DEFAULT_DRAFT_ROSTER_SLOTS);
  const scoring = rankingScoringFromRules(DEFAULT_DRAFT_SCORING_RULES);
  const bundle = buildAggregateBundle({
    scoring,
    teams,
    rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
  });
  const fetchedTimes = bundle.sourceHealth?.sources.flatMap((source) =>
    source.fetchedAt ? [Date.parse(source.fetchedAt)] : []
  ) ?? [];
  const now = new Date(Math.max(...fetchedTimes) + 60 * 60 * 1_000);
  const common = {
    candidates: Object.values(draftCandidateMapFromBundle(bundle)),
    sourceHealth: bundle.sourceHealth ?? null,
    projectionArtifact: bundle.draftProjections,
    teams,
    rounds,
    scoring,
    scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
    mode: "draft",
    season: "2026",
    shardCounts: draftReadinessShardCountsFromBundle(bundle),
    now,
  };
  return { bundle, common, assessment: assessDraftReadiness(common) };
}

describe("draft readiness", () => {
  it("accepts the current owner draft data and reports all cohorts", () => {
    const { assessment } = currentAssessment();

    expect(assessment.report.status).toBe("ready");
    expect(assessment.report.providers.fantasyPros.status).toBe("ready");
    expect(assessment.report.providers.sleeper.status).toBe("ready");
    expect(assessment.report.cohorts.core.coveragePct).toBe(100);
    expect(assessment.report.cohorts.expected.coveragePct).toBe(100);
    expect(assessment.report.cohorts.reserve.coveragePct).toBeGreaterThanOrEqual(95);
    expect(
      assessment.report.cohorts.expected.playerIds.filter((playerId) =>
        assessment.report.cohorts.reserve.playerIds.includes(playerId)
      )
    ).toEqual([]);
  });

  it("keeps reserve-only coverage gaps non-blocking", () => {
    const { common, assessment } = currentAssessment();
    if (!common.projectionArtifact) {
      throw new Error("The current draft fixture has no projection artifact.");
    }
    const issueIds = new Set(
      assessment.report.playerIssues.map((issue) => issue.playerId)
    );
    const reservePlayerId = assessment.report.cohorts.reserve.playerIds.find(
      (playerId) => !issueIds.has(playerId)
    );
    if (!reservePlayerId) {
      throw new Error("The current draft fixture has no ready reserve player.");
    }
    const players = { ...common.projectionArtifact.players };
    delete players[reservePlayerId];

    const result = assessDraftReadiness({
      ...common,
      projectionArtifact: { ...common.projectionArtifact, players },
    });

    expect(result.report.cohorts.reserve.status).toBe("warning");
    expect(result.report.status).toBe("ready");
    expect(result.report.incidents).not.toContainEqual(
      expect.objectContaining({ code: "COHORT_COVERAGE" })
    );
  });

  it("blocks recommendations and names an expected player with missing data", () => {
    const { common, assessment } = currentAssessment();
    const playerId = assessment.report.cohorts.core.playerIds[0];
    if (!playerId || !common.projectionArtifact) {
      throw new Error("The current draft fixture is incomplete.");
    }
    const player = common.candidates.find(
      (candidate) => candidate.player_id === playerId
    );
    const players = { ...common.projectionArtifact.players };
    delete players[playerId];

    const result = assessDraftReadiness({
      ...common,
      projectionArtifact: { ...common.projectionArtifact, players },
    });

    expect(result.report.status).toBe("incident");
    expect(result.report.cohorts.core.status).toBe("incident");
    expect(result.report.playerIssues).toContainEqual(
      expect.objectContaining({
        playerId,
        name: player?.name,
        problems: expect.arrayContaining([
          "Sleeper projection is missing.",
          "VAL cannot be calculated for the selected scoring.",
        ]),
      })
    );
  });

  it("blocks stale source data from the single readiness policy", () => {
    const { common } = currentAssessment();
    const result = assessDraftReadiness({
      ...common,
      now: new Date(common.now.getTime() + 49 * 60 * 60 * 1_000),
    });

    expect(result.report.status).toBe("incident");
    expect(result.report.incidents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "FETCH_STALE" }),
        expect.objectContaining({ code: "PROVIDER_STALE" }),
      ])
    );
  });

  it("blocks a provider artifact from the wrong season", () => {
    const { common } = currentAssessment();
    if (!common.sourceHealth) throw new Error("Source health is missing.");
    const sources = common.sourceHealth.sources.map((source) =>
      source.source === "FantasyPros" ? { ...source, season: "2025" } : source
    );

    const result = assessDraftReadiness({
      ...common,
      sourceHealth: { ...common.sourceHealth, sources },
    });

    expect(result.report.status).toBe("incident");
    expect(result.report.incidents).toContainEqual(
      expect.objectContaining({
        code: "WRONG_SOURCE_SEASON",
        scope: "FantasyPros",
      })
    );
  });

  it("does not require unused K or FLEX shards", () => {
    const { common } = currentAssessment();
    const rosterSlots = {
      ...common.rosterSlots,
      K: 0,
      FLEX: 0,
    };
    const result = assessDraftReadiness({
      ...common,
      rosterSlots,
      rounds: calculateDraftRounds(rosterSlots),
      shardCounts: { ...common.shardCounts, K: 0, FLEX: 0 },
    });

    expect(result.report.incidents).not.toContainEqual(
      expect.objectContaining({ code: "EMPTY_SHARD" })
    );
  });

  it("requires every generated shard for scheduled validation", () => {
    const { common } = currentAssessment();
    const result = assessDraftReadiness({
      ...common,
      shardCounts: { ...common.shardCounts, K: 0 },
      requireAllShards: true,
    });

    expect(result.report.status).toBe("incident");
    expect(result.report.incidents).toContainEqual(
      expect.objectContaining({
        code: "EMPTY_SHARD",
        message: "K aggregate shard is empty.",
      })
    );
  });

  it("names a top FantasyPros player missing from the merged candidates", () => {
    const { common } = currentAssessment();
    const sourcePlayer = common.sourceHealth?.fantasyProsPlayers
      .toSorted((left, right) => left.rankAve - right.rankAve)[0];
    if (!sourcePlayer) throw new Error("FantasyPros source players are missing.");
    const candidates = common.candidates.filter(
      (candidate) =>
        !(
          normalizePlayerName(candidate.name) === sourcePlayer.normalizedName &&
          candidate.position === sourcePlayer.position
        )
    );

    const result = assessDraftReadiness({ ...common, candidates });

    expect(result.report.status).toBe("incident");
    expect(result.report.playerIssues).toContainEqual(
      expect.objectContaining({
        name: sourcePlayer.name,
        cohorts: expect.arrayContaining(["core"]),
        problems: expect.arrayContaining([
          "Sleeper projection is missing.",
          "VAL cannot be calculated for the selected scoring.",
        ]),
      })
    );
  });

  it("names a top Sleeper player missing from the merged candidates", () => {
    const { common } = currentAssessment();
    if (!common.sourceHealth) throw new Error("Source health is missing.");
    const sleeperOnlyPlayer = {
      playerId: "sleeper-only-test",
      name: "Sleeper Only Test",
      normalizedName: "sleeperonlytest",
      position: "RB" as const,
      marketRank: 1,
    };

    const result = assessDraftReadiness({
      ...common,
      sourceHealth: {
        ...common.sourceHealth,
        sleeperPlayers: [sleeperOnlyPlayer, ...common.sourceHealth.sleeperPlayers],
      },
    });

    expect(result.report.status).toBe("incident");
    expect(result.report.playerIssues).toContainEqual(
      expect.objectContaining({
        playerId: sleeperOnlyPlayer.playerId,
        name: sleeperOnlyPlayer.name,
        cohorts: expect.arrayContaining(["core"]),
        problems: expect.arrayContaining([
          "FantasyPros ECR is missing.",
          "Sleeper projection is missing.",
        ]),
      })
    );
  });

  it("blocks a stale player row even when the provider report is current", () => {
    const { common, assessment } = currentAssessment();
    const playerId = assessment.report.cohorts.core.playerIds[0];
    const staleAt = common.now.getTime() - 49 * 60 * 60 * 1_000;
    const candidates = common.candidates.map((candidate) =>
      candidate.player_id === playerId
        ? { ...candidate, fp_rank_updated_at: staleAt }
        : candidate
    );

    const result = assessDraftReadiness({ ...common, candidates });

    expect(result.report.status).toBe("incident");
    expect(result.report.playerIssues).toContainEqual(
      expect.objectContaining({
        playerId,
        cohorts: expect.not.arrayContaining(["reserve"]),
        problems: expect.arrayContaining([
          "FantasyPros ECR is stale (49 hours old).",
        ]),
      })
    );
  });

  it("restores a known source market rank when the aggregate merge drops it", () => {
    const { common } = currentAssessment();
    const sourcePlayer = common.sourceHealth?.sleeperPlayers
      .toSorted((left, right) => left.marketRank - right.marketRank)[0];
    if (!sourcePlayer) throw new Error("Sleeper source players are missing.");
    const targetCandidate = common.candidates.find(
      (player) =>
        normalizePlayerName(player.name) === sourcePlayer.normalizedName &&
        player.position === sourcePlayer.position
    );
    if (!targetCandidate) throw new Error("The top Sleeper player is not merged.");
    const candidates = common.candidates.map((candidate) =>
      candidate.player_id === targetCandidate.player_id
        ? {
            ...candidate,
            fp_rank_ave: 300,
            sleeper_adp: 300,
            sleeper_board_rank: null,
          }
        : candidate
    );

    const result = assessDraftReadiness({ ...common, candidates });

    expect(result.report.status).toBe("ready");
    expect(result.report.cohorts.core.playerIds).toContain(
      targetCandidate.player_id
    );
  });
});
