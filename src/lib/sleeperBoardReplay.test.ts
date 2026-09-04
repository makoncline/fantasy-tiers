import { describe, expect, it } from "vitest";

import { resolveVerifiedSleeperReplayInput } from "@/lib/sleeperBoardReplay";
import { importSleeperDraftBoard } from "@/lib/sleeperDraftImport";

describe("Sleeper board replay configuration", () => {
  it("skips a pick board that has no verified league configuration", () => {
    const result = resolveVerifiedSleeperReplayInput({
      rawPicks: [{
        draft_slot: 1,
        round: 1,
        pick_no: 1,
        player_id: "player-1",
        metadata: {
          first_name: "Test",
          last_name: "Player",
          position: "RB",
          team: "DEN",
        },
      }],
      artifact: null,
      configSource: "/tmp/draft-result.json",
    });

    expect(result).toEqual({
      status: "skipped",
      code: "MISSING_CONFIG",
      reason: "No sibling draft-result.json contains the original league configuration.",
    });
  });

  it("rejects legacy draft results that omit exact scoring rules", () => {
    const result = resolveVerifiedSleeperReplayInput({
      rawPicks: [],
      artifact: { schemaVersion: 1 },
      configSource: "/tmp/draft-result.json",
    });

    expect(result).toMatchObject({
      status: "skipped",
      code: "UNVERIFIED_CONFIG",
    });
  });

  it("rejects an artifact that inferred settings from a pick-only import", () => {
    const rawPicks = [
      {
        draft_id: "pick-only",
        draft_slot: 1,
        round: 1,
        pick_no: 1,
        player_id: "player-1",
        metadata: {
          first_name: "Test",
          last_name: "Player",
          position: "RB" as const,
          team: "DEN",
        },
      },
      {
        draft_id: "pick-only",
        draft_slot: 2,
        round: 1,
        pick_no: 2,
        player_id: "player-2",
        metadata: {
          first_name: "Other",
          last_name: "Player",
          position: "WR" as const,
          team: "KC",
        },
      },
    ];
    const artifact = importSleeperDraftBoard(rawPicks, {
      userSlot: 1,
      rosterSlots: {
        QB: 0,
        RB: 1,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0,
        FLEX: 0,
        BENCH: 0,
        IR: 0,
      },
    });

    expect(resolveVerifiedSleeperReplayInput({
      rawPicks,
      artifact,
      configSource: "/tmp/draft-result.json",
    })).toMatchObject({
      status: "skipped",
      code: "UNVERIFIED_CONFIG",
    });
  });
});
