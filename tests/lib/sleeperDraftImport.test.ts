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
      leagueName: "Sleeper Test",
      exportedAt: "2026-07-11T12:00:00.000Z",
    });

    expect(DraftResultArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(artifact.source).toBe("sleeper-live");
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
