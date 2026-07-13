import { describe, expect, it } from "vitest";

import {
  DraftResultArtifactSchema,
  createMockDraftResultArtifact,
  draftResultDirectoryName,
} from "@/lib/draftResults";
import {
  advanceUntilUserTurn,
  createDefaultSimDraftConfig,
  createSimDraft,
  getSimDraftSnapshot,
  makeUserPick,
  toSleeperDraftDetails,
  toSleeperDraftPicks,
  type SimDraftPlayer,
} from "@/lib/simDraft";

const players = [
  p("rb1", "Runner One", "RB", 1, 1, 1),
  p("wr1", "Wide One", "WR", 2, 1, 2),
  p("rb2", "Runner Two", "RB", 3, 1, 3),
  p("wr2", "Wide Two", "WR", 4, 1, 4),
  p("qb1", "Passer One", "QB", 5, 2, 5),
  p("te1", "Tight One", "TE", 6, 2, 6),
  p("rb3", "Runner Three", "RB", 7, 2, 7),
  p("wr3", "Wide Three", "WR", 8, 2, 8),
] satisfies SimDraftPlayer[];

describe("draft result artifacts", () => {
  it("captures simulated draft state, Sleeper-shaped picks, and user roster", () => {
    const config = createDefaultSimDraftConfig({
      draftId: "sim result/1",
      teams: 4,
      rounds: 2,
      userSlot: 2,
      userId: "agent-user",
      seed: "result-test",
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
      },
    });
    const waiting = advanceUntilUserTurn(createSimDraft(config), players);
    const choice = getSimDraftSnapshot(waiting, players).availablePlayerIds[0];
    if (!choice) throw new Error("expected an available user pick");

    const state = makeUserPick(waiting, choice, players);
    const snapshot = getSimDraftSnapshot(state, players);
    const draftDetails = toSleeperDraftDetails(state);
    const draftPicks = toSleeperDraftPicks(state);

    const artifact = createMockDraftResultArtifact({
      state,
      snapshot,
      players,
      draftDetails,
      draftPicks,
      viewModel: { recommendation: choice },
      exportedAt: "2026-07-01T12:00:00.000Z",
    });

    expect(DraftResultArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(artifact.sleeper.draftDetails).toEqual(draftDetails);
    expect(artifact.sleeper.picks).toEqual(draftPicks);
    expect(artifact.summary.userPickCount).toBe(1);
    expect(artifact.players.userRoster.map((player) => player.player_id)).toContain(
      choice
    );
    expect(draftResultDirectoryName(artifact)).toBe(
      "20260701120000-sim-result-1-slot-2"
    );
  });
});

function p(
  player_id: string,
  name: string,
  position: SimDraftPlayer["position"],
  rank: number,
  tier: number,
  sleeperAdp: number
): SimDraftPlayer {
  return {
    player_id,
    name,
    position,
    team: position === "DEF" ? name : "KC",
    bye_week: "10",
    rank,
    tier,
    sleeperAdp,
    sleeperRank: rank,
  };
}
