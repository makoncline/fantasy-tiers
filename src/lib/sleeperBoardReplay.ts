import { DraftResultArtifactSchema, type DraftResultArtifact } from "@/lib/draftResults";
import { RawSleeperDraftBoardSchema } from "@/lib/sleeperDraftImport";

export type VerifiedSleeperReplayInput =
  | {
      status: "included";
      artifact: DraftResultArtifact;
      configSource: string;
    }
  | {
      status: "skipped";
      code: "INVALID_PICKS" | "MISSING_CONFIG" | "UNVERIFIED_CONFIG" | "PICK_MISMATCH";
      reason: string;
    };

export function resolveVerifiedSleeperReplayInput(input: {
  rawPicks: unknown;
  artifact: unknown | null;
  configSource: string;
}): VerifiedSleeperReplayInput {
  const rawPicks = RawSleeperDraftBoardSchema.safeParse(input.rawPicks);
  if (!rawPicks.success) {
    return {
      status: "skipped",
      code: "INVALID_PICKS",
      reason: "The Sleeper pick file is invalid.",
    };
  }
  if (input.artifact == null) {
    return {
      status: "skipped",
      code: "MISSING_CONFIG",
      reason: "No sibling draft-result.json contains the original league configuration.",
    };
  }

  const artifact = DraftResultArtifactSchema.safeParse(input.artifact);
  if (!artifact.success || artifact.data.source !== "sleeper-live") {
    return {
      status: "skipped",
      code: "UNVERIFIED_CONFIG",
      reason: "The sibling draft result does not contain verified schema-v2 live league settings.",
    };
  }

  const savedPicks = artifact.data.sleeper.picks.toSorted(
    (left, right) => left.pick_no - right.pick_no
  );
  const sourcePicks = rawPicks.data.toSorted(
    (left, right) => left.pick_no - right.pick_no
  );
  const picksMatch = savedPicks.length === sourcePicks.length &&
    savedPicks.every((pick, index) => {
      const sourcePick = sourcePicks[index];
      return sourcePick != null &&
        pick.pick_no === sourcePick.pick_no &&
        pick.draft_slot === sourcePick.draft_slot &&
        pick.player_id === sourcePick.player_id;
    });
  if (!picksMatch) {
    return {
      status: "skipped",
      code: "PICK_MISMATCH",
      reason: "The Sleeper pick file does not match the sibling draft result.",
    };
  }

  return {
    status: "included",
    artifact: artifact.data,
    configSource: input.configSource,
  };
}
