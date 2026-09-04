import { describe, expect, it } from "vitest";

import { DraftResultArtifactSchema } from "@/lib/draftResults";
import { importSleeperDraftBoard } from "@/lib/sleeperDraftImport";

describe("Sleeper draft board importer", () => {
  it("converts a raw Sleeper board into the canonical draft artifact", () => {
    const raw = [
      pick(1, 1, 1, "rb1", "Runner", "One", "RB"),
      pick(2, 2, 1, "wr1", "Wide", "One", "WR"),
      pick(3, 2, 2, "qb1", "Passer", "One", "QB"),
      pick(4, 1, 2, "te1", "Tight", "One", "TE"),
    ];

    const artifact = importSleeperDraftBoard(raw, {
      userSlot: 2,
      scoring: "half",
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
        BENCH: 0,
        IR: 1,
      },
      leagueName: "Sleeper Test",
      exportedAt: "2026-07-11T12:00:00.000Z",
    });

    expect(DraftResultArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(artifact.source).toBe("sleeper-picks-import");
    expect(artifact.summary).toMatchObject({
      draftId: "draft-1",
      teams: 2,
      rounds: 2,
      userSlot: 2,
      pickCount: 4,
      userPickCount: 2,
      status: "complete",
    });
    expect(artifact.players.userRoster.map((player) => player.player_id)).toEqual([
      "wr1",
      "qb1",
    ]);
  });

  it("uses exact live draft and league settings for a verified replay", () => {
    const raw = [
      pick(1, 1, 1, "rb1", "Runner", "One", "RB"),
      pick(2, 2, 1, "wr1", "Wide", "One", "WR"),
      pick(3, 2, 2, "qb1", "Passer", "One", "QB"),
      pick(4, 1, 2, "te1", "Tight", "One", "TE"),
    ];
    const artifact = importSleeperDraftBoard(raw, {
      userSlot: 2,
      draftDetails: {
        draft_id: "draft-1",
        league_id: null,
        type: "snake",
        season: "2026",
        status: "complete",
        metadata: {
          name: "Verified Sleeper Test",
          league_id: "league-1",
          scoring_type: "ppr",
        },
        settings: {
          teams: 2,
          rounds: 2,
          pick_timer: 60,
          slots_qb: 1,
          slots_rb: 0,
          slots_wr: 0,
          slots_te: 0,
          slots_k: 0,
          slots_def: 0,
          slots_flex: 0,
          slots_bn: 1,
          slots_ir: 1,
        },
        scoring_settings: null,
        draft_order: { "user-1": 1, "user-2": 2 },
        slot_to_roster_id: {},
      },
      league: {
        league_id: "league-1",
        name: "Verified Sleeper Test",
        season: "2026",
        scoring_settings: {
          rec: 0.69,
          rush_yd: 0.1,
          rec_yd: 0.1,
          rush_td: 6,
          rec_td: 6,
          pass_yd: 0.04,
          pass_td: 4,
          pass_int: -1,
          fum_lost: -2,
        },
      },
      exportedAt: "2026-09-04T12:00:00.000Z",
    });

    expect(DraftResultArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(artifact.source).toBe("sleeper-live");
    expect(artifact.state.config.scoringRules.reception).toBe(0.69);
    expect(artifact.state.config.rosterSlots).toMatchObject({
      QB: 1,
      BENCH: 1,
      IR: 1,
    });
    expect(artifact.state.config.userId).toBe("user-2");
  });
});

function pick(
  pick_no: number,
  draft_slot: number,
  round: number,
  player_id: string,
  first_name: string,
  last_name: string,
  position: "QB" | "RB" | "WR" | "TE"
) {
  return {
    draft_id: "draft-1",
    pick_no,
    draft_slot,
    round,
    player_id,
    metadata: { first_name, last_name, position, team: "KC" },
  };
}
