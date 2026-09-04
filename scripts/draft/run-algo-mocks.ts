import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import {
  draftResultDirectoryName,
} from "../../src/lib/draftResults";
import { runAlgorithmMockDraft } from "../../src/lib/algoMockDraft";
import { createDraftDecisionLog } from "../../src/lib/draftDecisionLog.server";
import {
  evaluateCoreStarterEcr,
  evaluateDraftQuality,
  type DraftQualityEvaluation,
} from "../../src/lib/draftEvaluation";
import {
  bundleToSimPlayers,
  createDefaultSimDraftConfig,
} from "../../src/lib/simDraft";
import {
  DEFAULT_DRAFT_SCORING_RULES,
  calculateDraftRounds,
  rankingScoringFromRules,
} from "../../src/lib/draftLeagueConfig";
import { parseDraftSlots, parseSimBatchArgs, timestamp } from "./cli";

type RunSummary = {
  run: number;
  slot: number;
  seed: string;
  resultDir: string;
  draftResultPath: string;
  decisionsPath: string;
  userRoster: string[];
  evaluation: DraftQualityEvaluation;
  coreStarterEcrScore: number | null;
  coreStarterEcrFinish: number | null;
};

async function main() {
  const args = parseSimBatchArgs(process.argv.slice(2), {
    seed: "algo-2026",
  });
  const slots = parseDraftSlots(args.slotsArg, args.teams);
  const batchDir = path.resolve(args.outDir, `algo-batch-${timestamp()}`);
  await mkdir(batchDir, { recursive: true });

  const rounds = calculateDraftRounds(args.rosterSlots);
  const scoringRules = {
    ...DEFAULT_DRAFT_SCORING_RULES,
    reception: args.reception,
  };
  const bundle = buildAggregateBundle({
    scoring: rankingScoringFromRules(scoringRules),
    teams: args.teams,
    rosterSlots: args.rosterSlots,
  });
  const players = bundleToSimPlayers(bundle);
  const summaries: RunSummary[] = [];

  for (let runIndex = 0; runIndex < args.runs; runIndex += 1) {
    for (const slot of slots) {
      const runNumber = runIndex + 1;
      const runSeed = `${args.seed}-run-${runNumber}-slot-${slot}`;
      const config = createDefaultSimDraftConfig({
        draftId: `sim-${runSeed}`,
        userId: "sim-user",
        season: "2026",
        leagueName: "Algorithm Mock Draft",
        teams: args.teams,
        userSlot: slot,
        scoringRules,
        draftType: args.draftType,
        seed: runSeed,
        rosterSlots: args.rosterSlots,
        botStrategy: args.botStrategy,
      });
      const run = runAlgorithmMockDraft({ config, players, bundle });
      const resultDir = path.join(
        batchDir,
        draftResultDirectoryName(run.artifact)
      );
      await mkdir(resultDir, { recursive: true });

      const draftResultPath = path.join(resultDir, "draft-result.json");
      const decisionsPath = path.join(resultDir, "algorithm-decisions.json");
      await writeFile(
        draftResultPath,
        JSON.stringify(run.artifact, null, 2),
        "utf8"
      );
      await writeFile(
        decisionsPath,
        JSON.stringify(createDraftDecisionLog({
          bundle,
          config,
          players,
          decisions: run.decisions,
        }), null, 2),
        "utf8"
      );

      const draftQuality = evaluateDraftQuality(run.artifact);
      const coreStarterEcr = evaluateCoreStarterEcr(run.artifact);
      const summary: RunSummary = {
        run: runNumber,
        slot,
        seed: runSeed,
        resultDir,
        draftResultPath,
        decisionsPath,
        userRoster: run.artifact.players.userRoster.map(formatRosterPlayer),
        evaluation: draftQuality,
        coreStarterEcrScore: coreStarterEcr.score,
        coreStarterEcrFinish: coreStarterEcr.finish,
      };

      summaries.push(summary);
      console.log(
        `${runSeed}: ${summary.userRoster.join(", ")} -> ${resultDir}`
      );
    }
  }

  const batchSummaryPath = path.join(batchDir, "batch-summary.json");
  await writeFile(
    batchSummaryPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        args: {
          runs: args.runs,
          slots,
          teams: args.teams,
          rounds,
          reception: args.reception,
          draftType: args.draftType,
          rosterSlots: args.rosterSlots,
          botStrategy: args.botStrategy,
        },
        sourceHealth: bundle.sourceHealth,
        playerCount: players.length,
        proof: summarizeBatchProof(summaries),
        runs: summaries,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(JSON.stringify({ batchDir, batchSummaryPath, runs: summaries }, null, 2));
}

function formatRosterPlayer(player: { name: string; position: string }) {
  return `${player.name} (${player.position})`;
}

function summarizeBatchProof(runs: readonly RunSummary[]) {
  const finishes = runs.flatMap((run) =>
    run.coreStarterEcrFinish == null ? [] : [run.coreStarterEcrFinish]
  );
  const scores = runs.flatMap((run) =>
    run.coreStarterEcrScore == null ? [] : [run.coreStarterEcrScore]
  );
  return {
    runCount: runs.length,
    mandatoryPassCount: runs.filter((run) => run.evaluation.mandatoryPass).length,
    completeRosterCount: runs.filter((run) => run.evaluation.rosterComplete).length,
    endgamePassCount: runs.filter((run) => run.evaluation.endgamePass).length,
    coreConstructionPassCount: runs.filter(
      (run) => run.evaluation.coreConstructionPass
    ).length,
    topSixTeCount: runs.filter((run) => run.evaluation.teTopSix === true).length,
    evaluatedTeCount: runs.filter((run) => run.evaluation.teTopSix != null).length,
    averageTeStarterPosRank: averageNullable(
      runs.map((run) => run.evaluation.teStarterPosRank)
    ),
    medianTeStarterPosRank: medianNullable(
      runs.map((run) => run.evaluation.teStarterPosRank)
    ),
    usableQbCount: runs.filter((run) => run.evaluation.qbUsable === true).length,
    evaluatedQbCount: runs.filter((run) => run.evaluation.qbUsable != null).length,
    averageQbStarterPosRank: averageNullable(
      runs.map((run) => run.evaluation.qbStarterPosRank)
    ),
    medianQbStarterPosRank: medianNullable(
      runs.map((run) => run.evaluation.qbStarterPosRank)
    ),
    earlyDefCount: runs.filter((run) =>
      run.evaluation.endgameIssues.some((issue) => issue.code === "DEF_EARLY")
    ).length,
    averageCoreStarterEcrScore:
      scores.length === 0
        ? null
        : Number(
            (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(2)
          ),
    averageCoreStarterEcrFinish:
      finishes.length === 0
        ? null
        : Number(
            (
              finishes.reduce((total, finish) => total + finish, 0) /
              finishes.length
            ).toFixed(2)
          ),
    firstPlaceCount: finishes.filter((finish) => finish === 1).length,
    topThreeCount: finishes.filter((finish) => finish <= 3).length,
  };
}

function averageNullable(values: readonly (number | null)[]) {
  const present = values.filter((value): value is number => value != null);
  return present.length === 0
    ? null
    : Number(
        (present.reduce((total, value) => total + value, 0) / present.length).toFixed(2)
      );
}

function medianNullable(values: readonly (number | null)[]) {
  const present = values
    .filter((value): value is number => value != null)
    .toSorted((left, right) => left - right);
  if (present.length === 0) return null;
  const midpoint = Math.floor(present.length / 2);
  if (present.length % 2 === 1) return present[midpoint] ?? null;
  return Number((((present[midpoint - 1] ?? 0) + (present[midpoint] ?? 0)) / 2).toFixed(2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
