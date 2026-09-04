import { describe, expect, it } from "vitest";

import {
  DraftDecisionLogSchema,
  type AlgorithmDraftCandidate,
} from "@/lib/draftDecisionLog";
import { createPlayerPoolSignature } from "@/lib/draftDecisionLog.server";
import {
  buildByeCoverage,
  buildDraftRetrospective,
} from "@/lib/draftRetrospective";
import { createMockDraftResultArtifact } from "@/lib/draftResults";
import {
  createDefaultSimDraftConfig,
  getSimDraftSnapshot,
  toSleeperDraftDetails,
  toSleeperDraftPicks,
  type SimDraftPlayer,
  type SimDraftState,
} from "@/lib/simDraft";

describe("draft retrospective", () => {
  it("keeps the canonical recommendation separate from market ECR", () => {
    const artifact = makeArtifact("mock-draft");
    const decisionLog = makeDecisionLog();
    const report = buildDraftRetrospective({ artifact, decisionLog, slot: 1, top: 2 });
    const first = report.picks[0];

    expect(report.sourceSnapshot.projectionFetchedAt).toBe(
      "2026-09-03T20:00:00.000Z"
    );
    expect(first?.strategyBestAvailable?.playerId).toBe("b");
    expect(first?.marketBestAvailable?.playerId).toBe("a");
    expect(first?.selectedStrategyRank).toBe(1);
    expect(first?.strategyBestAvailable).toMatchObject({
      staticValue: 12,
      recommendationScore: 18,
      scoreGap: 6,
      recommendationSummary: "Beer+ prefers B.",
    });
  });

  it("rejects a saved decision that does not match the actual pick", () => {
    const log = makeDecisionLog();
    const mismatched = DraftDecisionLogSchema.parse({
      ...log,
      decisions: log.decisions.map((decision, index) =>
        index === 0
          ? { ...decision, selected: candidate("a", "Market A", 2, 10, 8) }
          : decision
      ),
    });

    expect(() => buildDraftRetrospective({
      artifact: makeArtifact("mock-draft"),
      decisionLog: mismatched,
      slot: 1,
      top: 2,
    })).toThrow("Decision pick 1 selected a, but the draft selected b.");
  });

  it("creates market-only context for a live draft with no saved decision", () => {
    const report = buildDraftRetrospective({
      artifact: makeArtifact("sleeper-live"),
      decisionLog: null,
      slot: 1,
      top: 2,
    });

    expect(report.picks[0]).toMatchObject({
      canonicalDecisionRecorded: false,
      strategyBestAvailable: null,
      marketBestAvailable: { playerId: "a" },
    });
  });

  it("rejects a decision log from a different same-size player pool", () => {
    const artifact = makeArtifact("mock-draft");
    const changedPlayers = artifact.players.all.map((draftPlayer) =>
      draftPlayer.player_id === "d"
        ? { ...draftPlayer, player_id: "different-player" }
        : draftPlayer
    );

    expect(() => buildDraftRetrospective({
      artifact: {
        ...artifact,
        players: { ...artifact.players, all: changedPlayers },
      },
      decisionLog: makeDecisionLog(),
      slot: 1,
      top: 2,
    })).toThrow("Decision log player pool does not match the draft result.");
  });

  it("rejects a decision log from a different projection snapshot", () => {
    const log = makeDecisionLog();
    const mismatched = DraftDecisionLogSchema.parse({
      ...log,
      sourceSnapshot: {
        ...log.sourceSnapshot,
        projectionFetchedAt: "2026-09-03T21:00:00.000Z",
      },
    });

    expect(() => buildDraftRetrospective({
      artifact: makeArtifact("mock-draft"),
      decisionLog: mismatched,
      slot: 1,
      top: 2,
    })).toThrow("Decision log source snapshot does not match the draft result.");
  });

  it("keeps FLEX pileups and single-starter bye coverage", () => {
    const byePlayers = [
      { ...player("qb", "Only QB", 1), position: "QB" as const },
      { ...player("rb", "Starting RB", 2), position: "RB" as const },
      { ...player("wr", "Starting WR", 3), position: "WR" as const },
      { ...player("te", "Only TE", 4), position: "TE" as const },
    ];
    const coverage = buildByeCoverage(
      byePlayers.map((draftPlayer, index) =>
        pick(draftPlayer.player_id, 1, index + 1, index + 1)
      ),
      byePlayers
    );

    expect(coverage.conflicts).toContainEqual({
      label: "RB/WR/TE overlap",
      position: "FLEX",
      byeWeek: "10",
      players: ["Starting RB", "Starting WR", "Only TE"],
    });
    expect(coverage.singleStarterByes).toEqual([
      { position: "QB", byeWeek: "10", player: "Only QB" },
      { position: "TE", byeWeek: "10", player: "Only TE" },
    ]);
  });
});

function makeArtifact(source: "mock-draft" | "sleeper-live") {
  const config = createDefaultSimDraftConfig({
    draftId: "retrospective-test",
    userId: "test-user",
    teams: 2,
    userSlot: 1,
    seed: "retrospective-seed",
    rosterSlots: {
      QB: 0,
      RB: 1,
      WR: 0,
      TE: 0,
      K: 0,
      DEF: 0,
      FLEX: 0,
      BENCH: 1,
      IR: 0,
    },
  });
  const state: SimDraftState = {
    config,
    status: "complete",
    events: [],
    picks: [
      pick("b", 1, 1, 1),
      pick("a", 2, 2, 1),
      pick("d", 2, 3, 2),
      pick("c", 1, 4, 2),
    ],
  };
  return createMockDraftResultArtifact({
    state,
    snapshot: getSimDraftSnapshot(state, players),
    players,
    draftDetails: toSleeperDraftDetails(state),
    draftPicks: toSleeperDraftPicks(state),
    source,
    sourceSnapshot: sourceSnapshot(),
    exportedAt: "2026-09-03T20:00:00.000Z",
  });
}

function makeDecisionLog() {
  const artifact = makeArtifact("mock-draft");
  return DraftDecisionLogSchema.parse({
    schemaVersion: 1,
    generatedAt: "2026-09-03T20:00:00.000Z",
    sourceSnapshot: sourceSnapshot(),
    league: {
      teams: artifact.state.config.teams,
      rounds: artifact.state.config.rounds,
      rosterSlots: artifact.state.config.rosterSlots,
      scoringRules: artifact.state.config.scoringRules,
      draftType: artifact.state.config.draftType,
      botStrategy: artifact.state.config.botStrategy,
      seed: artifact.state.config.seed,
      slot: artifact.state.config.userSlot,
    },
    decisions: [
      decision(1, candidate("b", "Strategy B", 1, 12, 18), [
        candidate("b", "Strategy B", 1, 12, 18),
        candidate("a", "Market A", 2, 10, 12),
      ]),
      decision(4, candidate("c", "Later C", 1, 4, 6), [
        candidate("c", "Later C", 1, 4, 6),
      ]),
    ],
  });
}

function sourceSnapshot() {
  return {
    aggregateLastModified: 123,
    aggregateGeneratedAt: null,
    projectionFetchedAt: "2026-09-03T20:00:00.000Z",
    projectionSourceLastModified: "2026-09-03T19:00:00.000Z",
    playerPoolSize: players.length,
    playerPoolSignature: createPlayerPoolSignature(players),
  };
}

function decision(
  pickNo: number,
  selected: AlgorithmDraftCandidate,
  topOptions: AlgorithmDraftCandidate[]
) {
  return {
    pickNo,
    round: pickNo === 1 ? 1 : 2,
    pickInRound: pickNo === 1 ? 1 : 2,
    userSlot: 1,
    selected,
    topOptions,
    challengers: [],
    rosterCountsBefore: {},
    rosterNeedsBefore: {},
    availableCount: topOptions.length,
  };
}

function candidate(
  playerId: string,
  name: string,
  recommendationRank: number,
  staticValue: number,
  recommendationScore: number
): AlgorithmDraftCandidate {
  return {
    playerId,
    name,
    position: "RB",
    team: "DEN",
    byeWeek: 10,
    recommendationRank,
    recommendationScore,
    recommendationEdge: "Clear edge",
    recommendationEdgeDetail: "Saved explanation.",
    recommendationPros: ["Strong fit."],
    recommendationCons: [],
    dataQualityNotes: [],
    recommendationSummary: playerId === "b" ? "Beer+ prefers B." : "Saved option.",
    confidence: "high",
    scoreGap: recommendationScore - 12,
    staticValue,
    valueRank: recommendationRank,
    positionalValueRank: recommendationRank,
    positionTier: 1,
    comebackProbability: 0.1,
    comebackLabel: "unlikely",
    weightProfile: "starter_build",
    topComponents: [{ key: "value", label: "Value", value: staticValue }],
    reasonLabels: ["Best value"],
    reasonDetails: ["Saved detail."],
  };
}

function pick(player_id: string, draft_slot: number, pick_no: number, round: number) {
  return { player_id, draft_slot, pick_no, round };
}

const players = [
  player("a", "Market A", 1),
  player("b", "Strategy B", 2),
  player("c", "Later C", 3),
  player("d", "Other D", 4),
] satisfies SimDraftPlayer[];

function player(player_id: string, name: string, ecr: number): SimDraftPlayer {
  return {
    player_id,
    name,
    position: "RB",
    team: "DEN",
    bye_week: "10",
    rank: ecr,
    tier: 1,
    sleeperAdp: ecr,
    fp_rank_ave: ecr,
    fp_rank_pos: ecr,
  };
}
