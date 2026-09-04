import { describe, expect, it } from "vitest";

import {
  evaluateDraftQuality,
} from "@/lib/draftEvaluation";
import { createMockDraftResultArtifact } from "@/lib/draftResults";
import {
  createDefaultSimDraftConfig,
  getSimDraftSnapshot,
  toSleeperDraftDetails,
  toSleeperDraftPicks,
  type SimDraftPlayer,
  type SimDraftState,
} from "@/lib/simDraft";

describe("draft quality evaluation", () => {
  it("keeps a TE7 roster valid and reports TE quality separately", () => {
    const evaluation = evaluateDraftQuality(makeCompleteArtifact());

    expect(evaluation.rosterComplete).toBe(true);
    expect(evaluation.mandatoryIssues).toEqual([]);
    expect(evaluation.teStarterPosRank).toBe(7);
    expect(evaluation.teTopSix).toBe(false);
    expect(evaluation.qbEcrReachPicks).toBe(2);
    expect(evaluation.teEcrReachPicks).toBe(2);
    expect(evaluation.rbWrBenchAdpReachPicks).toBe(6);
    expect(evaluation.diagnosticIssues).toContainEqual(
      expect.objectContaining({ code: "TE_OUTSIDE_TOP_SIX" })
    );
  });

  it("does not fail construction only because QB or TE was selected late", () => {
    const evaluation = evaluateDraftQuality(makeCompleteArtifact());

    expect(evaluation.constructionIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "QB_LATE" }),
        expect.objectContaining({ code: "TE_LATE" }),
      ])
    );
  });

  it("fails a roster with a second QB or TE", () => {
    const evaluation = evaluateDraftQuality(makeArtifact({
      rosterSlots: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        K: 0,
        DEF: 1,
        FLEX: 1,
        BENCH: 3,
        IR: 0,
      },
      picks: [
        ["rb1", 1],
        ["wr1", 2],
        ["rb2", 3],
        ["wr2", 4],
        ["rb3", 5],
        ["qb9", 6],
        ["te7", 7],
        ["qb2", 8],
        ["te2", 9],
        ["wr3", 10],
        ["def1", 11],
      ],
    }));

    expect(evaluation.mandatoryPass).toBe(false);
    expect(evaluation.mandatoryIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "QB_COUNT" }),
        expect.objectContaining({ code: "TE_COUNT" }),
      ])
    );
  });

  it("reports incomplete rosters, special-team counts, and early D/ST separately", () => {
    const evaluation = evaluateDraftQuality(
      makeArtifact({
        rosterSlots: {
          QB: 1,
          RB: 2,
          WR: 2,
          TE: 1,
          K: 1,
          DEF: 1,
          FLEX: 1,
          BENCH: 0,
          IR: 0,
        },
        picks: [
          ["rb1", 1],
          ["wr1", 2],
          ["rb2", 3],
          ["def1", 4],
          ["wr2", 5],
          ["rb3", 6],
          ["te7", 7],
          ["rb4", 8],
          ["wr3", 9],
        ],
      })
    );

    expect(evaluation.rosterComplete).toBe(false);
    expect(evaluation.mandatoryIssues).toContainEqual(
      expect.objectContaining({ code: "ROSTER_INCOMPLETE" })
    );
    expect(evaluation.endgameIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "K_COUNT" }),
        expect.objectContaining({ code: "DEF_EARLY" }),
      ])
    );
  });

  it("fails a roster that contains a player confirmed out for the season", () => {
    const unavailablePlayers = players.map((candidate) =>
      candidate.player_id === "rb1"
        ? {
            ...candidate,
            sleeper_injury_status: "IR",
            sleeper_injury_notes: "Out for the season",
          }
        : candidate
    );
    const evaluation = evaluateDraftQuality(
      makeArtifact({
        rosterSlots: {
          QB: 1,
          RB: 2,
          WR: 2,
          TE: 1,
          K: 0,
          DEF: 1,
          FLEX: 1,
          BENCH: 2,
          IR: 1,
        },
        picks: [
          ["rb1", 1],
          ["wr1", 2],
          ["rb2", 3],
          ["rb3", 4],
          ["wr2", 5],
          ["qb9", 6],
          ["te7", 7],
          ["wr3", 8],
          ["rb4", 9],
          ["def1", 10],
        ],
        players: unavailablePlayers,
      })
    );

    expect(evaluation.mandatoryPass).toBe(false);
    expect(evaluation.availabilityCounts.unavailable).toBe(1);
    expect(evaluation.mandatoryIssues).toContainEqual(
      expect.objectContaining({ code: "UNAVAILABLE_PLAYER" })
    );
  });
});

function makeCompleteArtifact() {
  return makeArtifact({
    rosterSlots: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      K: 0,
      DEF: 1,
      FLEX: 1,
      BENCH: 2,
      IR: 0,
    },
    picks: [
      ["rb1", 1],
      ["wr1", 2],
      ["rb2", 3],
      ["rb3", 4],
      ["wr2", 5],
      ["qb9", 6],
      ["te7", 7],
      ["wr3", 8],
      ["rb4", 9],
      ["def1", 10],
    ],
  });
}

function makeArtifact(args: {
  rosterSlots: SimDraftState["config"]["rosterSlots"];
  picks: readonly (readonly [playerId: string, round: number])[];
  players?: readonly SimDraftPlayer[];
}) {
  const config = createDefaultSimDraftConfig({
    draftId: "evaluation-draft",
    userId: "evaluation-user",
    teams: 2,
    userSlot: 1,
    seed: "evaluation-contract",
    rosterSlots: args.rosterSlots,
  });
  const state: SimDraftState = {
    config,
    status: "complete",
    events: [],
    picks: args.picks.map(([playerId, round], index) => ({
      player_id: playerId,
      draft_slot: 1,
      pick_no: index + 1,
      round,
    })),
  };
  const playerPool = args.players ?? players;
  const snapshot = getSimDraftSnapshot(state, playerPool);

  return createMockDraftResultArtifact({
    state,
    snapshot,
    players: playerPool,
    draftDetails: toSleeperDraftDetails(state),
    draftPicks: toSleeperDraftPicks(state),
    exportedAt: "2026-09-03T20:00:00.000Z",
  });
}

const players = [
  player("rb1", "Runner One", "RB", 1, 1),
  player("rb2", "Runner Two", "RB", 2, 2),
  player("rb3", "Runner Three", "RB", 3, 3),
  player("rb4", "Runner Four", "RB", 4, 4),
  player("wr1", "Wide One", "WR", 5, 1),
  player("wr2", "Wide Two", "WR", 6, 2),
  { ...player("wr3", "Wide Three", "WR", 7, 3), sleeperAdp: 20 },
  player("qb9", "Passer Nine", "QB", 8, 9),
  player("qb2", "Passer Two", "QB", 2, 2),
  player("te7", "Tight Seven", "TE", 9, 7),
  player("te12", "Tight Twelve", "TE", 12, 12),
  player("te2", "Tight Two", "TE", 2, 2),
  player("k1", "Kicker One", "K", 10, 1),
  player("def1", "Defense One", "DEF", 11, 1),
] satisfies SimDraftPlayer[];

function player(
  player_id: string,
  name: string,
  position: SimDraftPlayer["position"],
  ecr: number,
  positionRank: number
): SimDraftPlayer {
  return {
    player_id,
    name,
    position,
    team: position === "DEF" ? name : "DEN",
    bye_week: "10",
    rank: ecr,
    tier: 1,
    sleeperAdp: ecr,
    fp_rank_ave: ecr,
    fp_rank_pos: positionRank,
  };
}
