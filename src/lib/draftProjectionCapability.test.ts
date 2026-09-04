import { describe, expect, it } from "vitest";

import { buildAggregateBundle } from "@/lib/aggregateBundle";
import {
  buildStarterAwareStrategy,
  reconcileSleeperStandardProjection,
} from "@/lib/beerPlusStrategy";
import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
  rankingScoringFromRules,
} from "@/lib/draftLeagueConfig";
import { bundleToSimPlayers } from "@/lib/simDraft";

describe("saved Sleeper projection capability", () => {
  it("supports the owner format and explains every standard-points difference", () => {
    const bundle = buildAggregateBundle({
      scoring: rankingScoringFromRules(DEFAULT_DRAFT_SCORING_RULES),
      teams: 12,
      rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
    });
    const artifact = bundle.draftProjections;
    expect(artifact).not.toBeNull();
    if (!artifact) throw new Error("Sleeper draft projections are missing.");
    expect(artifact.sourceLastModified).toBeTypeOf("string");
    if (!artifact.sourceLastModified) {
      throw new Error("Sleeper projection source timestamp is missing.");
    }

    const players = bundleToSimPlayers(bundle);
    const strategy = buildStarterAwareStrategy({
      artifact,
      players: players.map((player) => ({
        playerId: player.player_id,
        position: player.position,
        ecr: player.fp_rank_ave ?? null,
      })),
      teams: 12,
      rounds: 14,
      rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
      scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    });
    expect(strategy.status).toMatchObject({
      available: true,
      capabilityLimitations: [],
    });
    expect(strategy.status.requiredStatCoveragePct).toBeGreaterThanOrEqual(85);

    const relevantIds = new Set(
      players
        .filter((player) =>
          player.fp_rank_ave != null && player.fp_rank_ave <= 350
        )
        .map((player) => player.player_id)
    );
    const reconciliations = Object.values(artifact.players)
      .filter((projection) =>
        relevantIds.has(projection.playerId) &&
        ["QB", "RB", "WR", "TE"].includes(projection.position) &&
        projection.stats.pts_std != null
      )
      .map((projection) => reconcileSleeperStandardProjection({
        position: projection.position,
        stats: projection.stats,
      }));
    expect(reconciliations.length).toBeGreaterThan(100);
    expect(
      reconciliations.filter((result) => result.status === "unexplained")
    ).toEqual([]);
    expect(
      reconciliations.some((result) => result.status === "named-unsupported")
    ).toBe(true);

    const defense = Object.values(artifact.players).find(
      (projection) =>
        projection.position === "DEF" && projection.stats.pts_std != null
    );
    expect(defense?.stats.pts_std).toBeTypeOf("number");
  });
});
