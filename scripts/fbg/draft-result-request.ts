import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DraftResultArtifactSchema } from "../../src/lib/draftResults";

export type BuildFootballguysRequestOptions = {
  draftResultPath: string;
  outputPath?: string | undefined;
  passingTouchdowns?: string | undefined;
  passingYards?: string | undefined;
  slot: number;
};

export async function writeFootballguysRequestFromDraftResult(
  options: BuildFootballguysRequestOptions
) {
  const artifact = DraftResultArtifactSchema.parse(
    JSON.parse(await readFile(options.draftResultPath, "utf8"))
  );
  const roster = artifact.players.rostersBySlot[String(options.slot)] ?? [];
  if (!roster.length) {
    throw new Error(`No roster found for draft slot ${options.slot}.`);
  }

  const outputPath =
    options.outputPath ??
    path.join(
      path.dirname(options.draftResultPath),
      `footballguys-slot-${options.slot}-request.json`
    );
  const config = artifact.state.config;
  const request = {
    capturedAt: new Date().toISOString(),
    sourceDraftResult: {
      draftResultPath: options.draftResultPath,
      draftId: artifact.summary.draftId,
      slot: options.slot,
      isUserSlot: options.slot === config.userSlot,
    },
    manualEntryFields: {
      leagueName: artifact.summary.leagueName,
      numTeams: String(config.teams),
      ppr: scoringToPpr(config.scoring),
      passingYards: options.passingYards ?? "25",
      passingTouchdowns: options.passingTouchdowns ?? "4",
      quarterbacks: String(config.rosterSlots.QB),
      runningBacks: String(config.rosterSlots.RB),
      wideReceivers: String(config.rosterSlots.WR),
      tightEnds: String(config.rosterSlots.TE),
      flex: String(config.rosterSlots.FLEX),
      superflex: "0",
      teamDefense: String(config.rosterSlots.DEF),
      kicker: String(config.rosterSlots.K),
      teamName: `Slot ${options.slot} ${
        options.slot === config.userSlot ? "User" : "Bot"
      }`,
      players: roster.map((player) => ({
        sleeperId: player.player_id,
        name: player.name,
        position: player.position,
      })),
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(request, null, 2), "utf8");
  return {
    artifact,
    outputPath,
    players: roster.map((player) => player.name),
    request,
  };
}

export function resultDirDraftResult(resultDir: string | undefined) {
  return resultDir ? path.join(resultDir, "draft-result.json") : undefined;
}

function scoringToPpr(scoring: "std" | "half" | "ppr") {
  if (scoring === "ppr") return "1";
  if (scoring === "half") return "0.5";
  return "0";
}
