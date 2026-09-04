import { describe, expect, it } from "vitest";

import { DraftDetailsSchema } from "../../src/lib/draftDetails";
import { DEFAULT_DRAFT_SCORING_RULES } from "../../src/lib/draftLeagueConfig";
import { buildDraftViewModel } from "../../src/lib/draftState";

const updatedAt = Date.parse("2026-09-04T00:00:00.000Z");

function projection(playerId: string, rank: number) {
  return {
    playerId,
    position: "RB" as const,
    stats: {
      rush_yd: 1_000 - (rank - 1) * 100,
      rush_td: 9 - rank,
      rec: 42 - rank * 2,
      rec_yd: 320 - rank * 20,
      rec_td: 2,
      pts_std: 208 - rank * 18,
    },
    lastModified: updatedAt,
    newsUpdated: null,
  };
}

function player(playerId: string, rank: number) {
  return {
    player_id: playerId,
    name: playerId,
    position: "RB" as const,
    team: "SF",
    bye_week: null,
    rank,
    tier: 1,
    tier_rank: rank,
    tier_level: 1,
    position_tier_level: 1,
    sleeper_tier_level: 1,
    fp_rank_ave: rank,
    fp_rank_pos: rank,
    sleeper_adp: rank,
    sleeper_board_rank: rank,
    sleeper_injury_status: null,
    sleeper_injury_notes: null,
    fp_rank_updated_at: updatedAt,
    sleeper_projection: projection(playerId, rank),
  };
}

const playersMap = {
  rb1: player("rb1", 1),
  rb2: player("rb2", 2),
  rb3: player("rb3", 3),
  rb4: player("rb4", 4),
};

const draft = DraftDetailsSchema.parse({
  draft_id: "draft-1",
  type: "snake",
  settings: {
    teams: 4,
    rounds: 4,
    slots_rb: 1,
  },
  draft_order: {},
  slot_to_roster_id: {},
  scoring_settings: {},
  metadata: {},
});

const sourceHealth = {
  generatedAt: "2026-09-04T00:00:00.000Z",
  scoring: "ppr" as const,
  sources: [
    {
      source: "FantasyPros" as const,
      status: "available" as const,
      season: "2026",
      fetchedAt: "2026-09-04T00:00:00.000Z",
      lastUpdated: "2026-09-04T00:00:00.000Z",
      rowCount: 4,
      expertsIncluded: 100,
      expertsAvailable: 120,
      expertCoveragePct: 83.3,
      problems: [],
    },
    {
      source: "Sleeper" as const,
      status: "available" as const,
      season: "2026",
      fetchedAt: "2026-09-04T00:00:00.000Z",
      lastUpdated: "2026-09-04T00:00:00.000Z",
      rowCount: 4,
      expertsIncluded: null,
      expertsAvailable: null,
      expertCoveragePct: null,
      problems: [],
    },
  ],
  fantasyProsPlayers: [],
  sleeperPlayers: [],
};

const commonArgs = {
  playersMap,
  draft,
  picks: [],
  userId: "user-1",
  scoringRules: DEFAULT_DRAFT_SCORING_RULES,
  sourceHealth,
  shardCounts: {
    ALL: 4,
    QB: 1,
    RB: 4,
    WR: 1,
    TE: 1,
    K: 1,
    DEF: 1,
    FLEX: 4,
  },
  evaluationNow: new Date("2026-09-04T01:00:00.000Z"),
  projectionArtifact: {
    schemaVersion: 1 as const,
    source: "Sleeper season projections" as const,
    season: "2026",
    fetchedAt: "2026-09-04T00:00:00.000Z",
    sourceLastModified: "2026-09-04T00:00:00.000Z",
    players: Object.fromEntries(
      Object.keys(playersMap).map((playerId, index) => [
        playerId,
        projection(playerId, index + 1),
      ])
    ),
  },
};

describe("drafts without a finalized Sleeper order", () => {
  it("keeps raw player values available before a user slot is known", () => {
    const viewModel = buildDraftViewModel(commonArgs);

    expect(
      viewModel.readiness?.status,
      JSON.stringify(viewModel.readiness?.incidents)
    ).toBe("ready");
    expect(viewModel.recommendationBoard).toBeNull();
    expect(viewModel.draftRawValuesByPlayerId.rb1).toEqual(expect.any(Number));
  });

  it("uses a manual slot to build adjusted values and recommendations", () => {
    const viewModel = buildDraftViewModel({ ...commonArgs, userSlot: 4 });

    expect(viewModel.userRoster).toBeDefined();
    expect(viewModel.recommendationBoard?.topRecommendation).not.toBeNull();
    expect(
      viewModel.recommendationBoard?.metricsByPlayerId.rb1?.recommendationScore
    ).toEqual(expect.any(Number));
  });
});
