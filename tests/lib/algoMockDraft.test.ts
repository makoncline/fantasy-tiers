import { describe, expect, it } from "vitest";

import { buildAggregateBundle } from "@/lib/aggregateBundle";
import { runAlgorithmMockDraft } from "@/lib/algoMockDraft";
import {
  bundleToSimPlayers,
  createDefaultSimDraftConfig,
} from "@/lib/simDraft";

function countPositions(roster: ReadonlyArray<{ position: string }>) {
  return roster.reduce<Record<string, number>>((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

describe("runAlgorithmMockDraft", () => {
  it("runs a full draft by taking the top recommendation at each user pick", () => {
    const rosterSlots = {
      QB: 1,
      RB: 1,
      WR: 1,
      TE: 1,
      K: 1,
      DEF: 1,
      FLEX: 0,
    };
    const bundle = buildAggregateBundle({
      scoring: "std",
      teams: 4,
      rosterSlots: { ...rosterSlots, BENCH: 0 },
    });
    const players = bundleToSimPlayers(bundle);
    const config = createDefaultSimDraftConfig({
      draftId: "test-algo-mock",
      teams: 4,
      rounds: 6,
      userSlot: 2,
      seed: "test-algo-mock",
      rosterSlots,
    });

    const run = runAlgorithmMockDraft({ config, players, bundle });

    expect(run.artifact.summary.status).toBe("complete");
    expect(run.artifact.summary.pickCount).toBe(24);
    expect(run.artifact.summary.userPickCount).toBe(6);
    expect(run.decisions).toHaveLength(6);
    expect(run.decisions.every((decision) => {
      return decision.selected.recommendationRank === 1;
    })).toBe(true);
    expect(run.decisions[0]?.topOptions.length).toBeGreaterThan(1);
    expect(run.decisions[0]?.selected.recommendationEdgeDetail).toContain("(");
    expect(run.decisions[0]?.selected.recommendationPros.length).toBeGreaterThan(0);
    expect(
      run.decisions[0]?.topOptions.every(
        (option) => option.recommendationSummary.length > 0
      )
    ).toBe(true);
    expect(
      run.artifact.players.userRoster.some(
        (player) => player.fp_rank_ave != null && player.fbg_rank != null
      )
    ).toBe(true);
  }, 15_000);

  it("fills a complete default lineup without backup-only detours", () => {
    const rosterSlots = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      K: 1,
      DEF: 1,
      FLEX: 1,
    };
    const bundle = buildAggregateBundle({
      scoring: "std",
      teams: 10,
      rosterSlots: { ...rosterSlots, BENCH: 6 },
    });
    const players = bundleToSimPlayers(bundle);
    const config = createDefaultSimDraftConfig({
      draftId: "test-algo-default-lineup",
      teams: 10,
      rounds: 15,
      userSlot: 5,
      seed: "test-algo-default-lineup",
      rosterSlots,
    });

    const run = runAlgorithmMockDraft({ config, players, bundle });
    const roster = run.artifact.players.rostersBySlot[String(config.userSlot)] ?? [];
    const counts = countPositions(roster);
    const flexEligible =
      Math.max(0, (counts.RB ?? 0) - rosterSlots.RB) +
      Math.max(0, (counts.WR ?? 0) - rosterSlots.WR) +
      Math.max(0, (counts.TE ?? 0) - rosterSlots.TE);

    expect(run.artifact.summary.status).toBe("complete");
    expect(run.artifact.summary.userPickCount).toBe(15);
    expect(counts.QB).toBe(1);
    expect(counts.TE).toBe(1);
    expect(counts.K).toBe(1);
    expect(counts.DEF).toBe(1);
    expect(counts.RB).toBeGreaterThanOrEqual(rosterSlots.RB);
    expect(counts.WR).toBeGreaterThanOrEqual(rosterSlots.WR);
    expect(flexEligible).toBeGreaterThanOrEqual(rosterSlots.FLEX);
  }, 15_000);
});
