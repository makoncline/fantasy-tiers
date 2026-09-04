import { describe, expect, it } from "vitest";

import {
  createDefaultSimDraftConfig,
  createSimDraft,
  makeUserPick,
  type SimDraftPlayer,
  type SimDraftState,
} from "@/lib/simDraft";

describe("simulated draft roster policy", () => {
  it.each([
    ["QB", "qb1", "qb2"],
    ["TE", "te1", "te2"],
    ["K", "k1", "k2"],
    ["DEF", "def1", "def2"],
  ] as const)("rejects a second %s at the pick state transition", (position, first, second) => {
    const rosterSlots = {
      QB: position === "QB" ? 1 : 0,
      RB: 0,
      WR: 0,
      TE: position === "TE" ? 1 : 0,
      K: position === "K" ? 1 : 0,
      DEF: position === "DEF" ? 1 : 0,
      FLEX: 0,
      BENCH: 1,
      IR: 0,
    };
    const players = [
      player(first, position, 1),
      player(second, position, 2),
      player("rb1", "RB", 3),
      player("wr1", "WR", 4),
    ];
    const config = createDefaultSimDraftConfig({
      teams: 2,
      userSlot: 1,
      seed: `single-${position}`,
      rosterSlots,
    });
    const initial = createSimDraft(config);
    const onSecondUserTurn: SimDraftState = {
      ...initial,
      status: "drafting",
      picks: [
        { player_id: first, draft_slot: 1, pick_no: 1, round: 1 },
        { player_id: "rb1", draft_slot: 2, pick_no: 2, round: 1 },
        { player_id: "wr1", draft_slot: 2, pick_no: 3, round: 2 },
      ],
    };

    expect(() => makeUserPick(onSecondUserTurn, second, players)).toThrow(
      `${position} is limited to one player`
    );
  });
});

function player(
  player_id: string,
  position: SimDraftPlayer["position"],
  rank: number
): SimDraftPlayer {
  return {
    player_id,
    name: player_id,
    position,
    team: position === "DEF" ? player_id : "DEN",
    bye_week: null,
    rank,
    tier: null,
    sleeper_adp: rank,
  };
}
