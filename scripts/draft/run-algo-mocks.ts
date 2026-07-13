import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import {
  draftResultDirectoryName,
  type DraftResultArtifact,
} from "../../src/lib/draftResults";
import { runAlgorithmMockDraft } from "../../src/lib/algoMockDraft";
import {
  bundleToSimPlayers,
  createDefaultSimDraftConfig,
  type SimDraftType,
  type SimBotStrategyId,
  type SimRosterSlots,
} from "../../src/lib/simDraft";
import type { ScoringType } from "../../src/lib/schemas";

const execFileAsync = promisify(execFile);

type Args = {
  analyze: boolean;
  analyzeDelayMs: number;
  analyzeSlots: string;
  botStrategy: SimBotStrategyId;
  draftType: SimDraftType;
  fbgEnv?: string | undefined;
  outDir: string;
  rounds: number;
  runs: number;
  scoring: ScoringType;
  seed: string;
  slotsArg?: string | undefined;
  teams: number;
  rosterSlots: SimRosterSlots;
};

type RunSummary = {
  run: number;
  slot: number;
  seed: string;
  resultDir: string;
  draftResultPath: string;
  decisionsPath: string;
  userRoster: string[];
  positionSequence: string[];
  positionCounts: Record<string, number>;
  qbRound: number | null;
  qbStarterName: string | null;
  qbStarterValue: number | null;
  qbStarterPosRank: number | null;
  teRound: number | null;
  teStarterName: string | null;
  teStarterValue: number | null;
  teStarterPosRank: number | null;
  rb2Round: number | null;
  wr2Round: number | null;
  kRound: number | null;
  defRound: number | null;
  qualityIssues: string[];
  qualityPasses: string[];
  analyzerOverallGrade?: string | undefined;
  analyzerPositionGrades?: string[] | undefined;
  analyzerSummaryPath?: string | undefined;
  analyzerError?: string | undefined;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slots = parseSlots(args.slotsArg, args.teams);
  const batchDir = path.resolve(args.outDir, `algo-batch-${timestamp()}`);
  await mkdir(batchDir, { recursive: true });

  const benchSlots = Math.max(0, args.rounds - starterCount(args.rosterSlots));
  const bundle = buildAggregateBundle({
    scoring: args.scoring,
    teams: args.teams,
    rosterSlots: { ...args.rosterSlots, BENCH: benchSlots },
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
        rounds: args.rounds,
        userSlot: slot,
        scoring: args.scoring,
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
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            draftResultPath,
            decisions: run.decisions,
          },
          null,
          2
        ),
        "utf8"
      );

      const draftQuality = summarizeDraftQuality(run.artifact, run.decisions);
      const summary: RunSummary = {
        run: runNumber,
        slot,
        seed: runSeed,
        resultDir,
        draftResultPath,
        decisionsPath,
        userRoster: run.artifact.players.userRoster.map(formatRosterPlayer),
        positionSequence: draftQuality.positionSequence,
        positionCounts: countPositions(run.artifact),
        qbRound: draftQuality.qbRound,
        qbStarterName: draftQuality.qbStarterName,
        qbStarterValue: draftQuality.qbStarterValue,
        qbStarterPosRank: draftQuality.qbStarterPosRank,
        teRound: draftQuality.teRound,
        teStarterName: draftQuality.teStarterName,
        teStarterValue: draftQuality.teStarterValue,
        teStarterPosRank: draftQuality.teStarterPosRank,
        rb2Round: draftQuality.rb2Round,
        wr2Round: draftQuality.wr2Round,
        kRound: draftQuality.kRound,
        defRound: draftQuality.defRound,
        qualityIssues: draftQuality.issues,
        qualityPasses: draftQuality.passes,
      };

      if (args.analyze) {
        const analyzerResult = await analyzeRun({
          analyzeSlots:
            args.analyzeSlots === "user" ? String(slot) : args.analyzeSlots,
          delayMs: args.analyzeDelayMs,
          env: args.fbgEnv,
          resultDir,
        });
        summary.analyzerSummaryPath = analyzerResult.summaryPath;
        summary.analyzerError = analyzerResult.error;
        if (analyzerResult.summaryPath) {
          const analyzerSummary = await readAnalyzerSummary(
            analyzerResult.summaryPath
          );
          summary.analyzerOverallGrade = analyzerSummary.overallGrade;
          summary.analyzerPositionGrades = analyzerSummary.positionGrades;
        }
      }

      summaries.push(summary);
      console.log(
        `${runSeed}: ${summary.userRoster.join(", ")} -> ${resultDir}`
      );

      if (args.analyze && args.analyzeDelayMs > 0 && hasMoreRuns({
        currentRunIndex: runIndex,
        currentSlot: slot,
        runs: args.runs,
        slots,
      })) {
        await sleep(args.analyzeDelayMs);
      }
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
          rounds: args.rounds,
          scoring: args.scoring,
          draftType: args.draftType,
          rosterSlots: args.rosterSlots,
          analyze: args.analyze,
          analyzeDelayMs: args.analyzeDelayMs,
          analyzeSlots: args.analyzeSlots,
          botStrategy: args.botStrategy,
        },
        sourceHealth: bundle.sourceHealth,
        playerCount: players.length,
        runs: summaries,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(JSON.stringify({ batchDir, batchSummaryPath, runs: summaries }, null, 2));
}

function hasMoreRuns(args: {
  currentRunIndex: number;
  currentSlot: number;
  runs: number;
  slots: readonly number[];
}) {
  const isLastRun = args.currentRunIndex === args.runs - 1;
  const isLastSlot = args.currentSlot === args.slots[args.slots.length - 1];
  return !(isLastRun && isLastSlot);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeRun(args: {
  analyzeSlots: string;
  delayMs: number;
  env?: string | undefined;
  resultDir: string;
}) {
  const commandArgs = [
    "--import=tsx",
    "scripts/fbg/analyze-draft-result.ts",
    "--result-dir",
    args.resultDir,
    "--slots",
    args.analyzeSlots,
    "--delay-ms",
    String(args.delayMs),
    "--skip-existing",
    "--continue-on-error",
  ];
  if (args.env) {
    commandArgs.push("--env", args.env);
  }

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, commandArgs, {
      cwd: process.cwd(),
      maxBuffer: 16 * 1024 * 1024,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return {
      summaryPath: await findAnalyzerSummaryPath(args.resultDir, args.analyzeSlots),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readAnalyzerSummary(summaryPath: string) {
  const parsed = JSON.parse(await readFile(summaryPath, "utf8")) as {
    reports?: Array<{
      overallGrade?: string;
      positionGrades?: string[];
    }>;
  };
  const report = parsed.reports?.find((item) => item.overallGrade) ??
    parsed.reports?.[0];
  return {
    overallGrade: report?.overallGrade,
    positionGrades: report?.positionGrades,
  };
}

async function findAnalyzerSummaryPath(resultDir: string, slotsArg: string) {
  const fileName =
    slotsArg === "all"
      ? "footballguys-all-teams-summary.json"
      : `footballguys-slots-${slotsArg.split(",").join("-")}-summary.json`;
  const summaryPath = path.join(resultDir, fileName);
  await readFile(summaryPath, "utf8");
  return summaryPath;
}

function formatRosterPlayer(player: { name: string; position: string }) {
  return `${player.name} (${player.position})`;
}

function countPositions(artifact: DraftResultArtifact) {
  return artifact.players.userRoster.reduce<Record<string, number>>(
    (acc, player) => {
      acc[player.position] = (acc[player.position] ?? 0) + 1;
      return acc;
    },
    {}
  );
}

function summarizeDraftQuality(
  artifact: DraftResultArtifact,
  decisions: readonly {
    selected: {
      name: string;
      position: string;
      staticValue: number | null;
      positionalValueRank: number | null;
      positionTier?: number | null;
    };
  }[]
) {
  const playersById = new Map(
    artifact.players.all.map((player) => [player.player_id, player])
  );
  const userPicks = artifact.sleeper.picks
    .filter((pick) => pick.draft_slot === artifact.summary.userSlot)
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((pick) => ({
      pick,
      player: playersById.get(pick.player_id) ?? null,
    }));
  const positionSequence = userPicks.map(
    ({ player }) => player?.position ?? "?"
  );
  const roundsByPosition = (position: string) =>
    userPicks
      .filter(({ player }) => player?.position === position)
      .map(({ pick }) => pick.round);
  const nthRound = (position: string, count: number) =>
    roundsByPosition(position)[count - 1] ?? null;
  const positionCounts = countPositions(artifact);
  const issues: string[] = [];
  const passes: string[] = [];
  const rounds = artifact.summary.rounds;
  const qbRound = nthRound("QB", 1);
  const qbStarter = userPicks.find(({ player }) => player?.position === "QB")
    ?.player ?? null;
  const qbDecision = decisions.find(
    (decision) => decision.selected.position === "QB"
  );
  const qbStarterName = qbDecision?.selected.name ?? qbStarter?.name ?? null;
  const qbStarterValue = toNullableNumber(qbDecision?.selected.staticValue);
  const qbStarterPosRank =
    toNullableNumber(qbDecision?.selected.positionalValueRank) ??
    toNullableNumber(qbStarter?.fp_rank_pos);
  const qbStarterPositionTier = toNullableNumber(
    qbDecision?.selected.positionTier
  );
  const teRound = nthRound("TE", 1);
  const teStarter = userPicks.find(({ player }) => player?.position === "TE")
    ?.player ?? null;
  const teDecision = decisions.find(
    (decision) => decision.selected.position === "TE"
  );
  const teStarterName = teDecision?.selected.name ?? teStarter?.name ?? null;
  const teStarterValue = toNullableNumber(teDecision?.selected.staticValue);
  const teStarterPosRank =
    toNullableNumber(teDecision?.selected.positionalValueRank) ??
    toNullableNumber(teStarter?.fp_rank_pos);
  const teStarterPositionTier = toNullableNumber(
    teDecision?.selected.positionTier
  );
  const rb2Round = nthRound("RB", 2);
  const wr2Round = nthRound("WR", 2);
  const kRound = nthRound("K", 1);
  const defRound = nthRound("DEF", 1);
  const rbCount = positionCounts.RB ?? 0;
  const wrCount = positionCounts.WR ?? 0;
  const qbCount = positionCounts.QB ?? 0;
  const teCount = positionCounts.TE ?? 0;
  const lowCeilingQbStarter =
    qbStarter != null &&
    ((qbStarterValue != null && qbStarterValue < 0) ||
      (qbStarterPosRank != null && qbStarterPosRank > 18));
  const weakQbStarter =
    qbStarter != null &&
    (qbStarterPositionTier !== 1 ||
      qbStarterPosRank == null ||
      qbStarterPosRank > 3);
  const strongQbOffset =
    qbStarter != null &&
    qbStarterPositionTier === 1 &&
    qbStarterPosRank != null &&
    qbStarterPosRank <= 3;
  const earlyEliteQbStarter =
    qbRound != null &&
    qbRound <= 5 &&
    qbStarterPositionTier === 1;
  const weakTeStarter =
    teStarter != null &&
    (teStarterValue != null || teStarterPosRank != null) &&
    (teStarterPositionTier !== 1 ||
      teStarterPosRank == null ||
      teStarterPosRank > 2) &&
    (teStarterValue == null || teStarterValue < 170);

  addGate({
    condition: qbCount === 1 || (qbCount === 2 && weakQbStarter),
    pass:
      qbCount === 2
        ? "late backup QB for non-elite starter"
        : "exactly one QB",
    issue: `expected one QB, drafted ${qbCount}`,
    issues,
    passes,
  });
  addGate({
    condition: teCount === 1,
    pass: "exactly one TE",
    issue: `expected one TE, drafted ${teCount}`,
    issues,
    passes,
  });
  addGate({
    condition: rbCount >= 5 && rbCount <= 6,
    pass: "RB depth in target range",
    issue: `RB depth outside target range: ${rbCount}`,
    issues,
    passes,
  });
  addGate({
    condition: wrCount >= 5 && wrCount <= 6,
    pass: "WR depth in target range",
    issue: `WR depth outside target range: ${wrCount}`,
    issues,
    passes,
  });
  addGate({
    condition:
      wr2Round != null &&
      (wr2Round <= 5 || (earlyEliteQbStarter && wr2Round <= 6)),
    pass: earlyEliteQbStarter ? "WR2 by round 6 after elite QB" : "WR2 by round 5",
    issue: `WR2 too late: ${wr2Round ?? "missing"}`,
    issues,
    passes,
  });
  addGate({
    condition: qbRound != null && qbRound <= 10,
    pass: "QB starter by round 10",
    issue: `QB starter too late: ${qbRound ?? "missing"}`,
    issues,
    passes,
  });
  addGate({
    condition: !lowCeilingQbStarter,
    pass: "QB starter clears usable floor",
    issue: `QB starter below usable floor: ${formatQbStarter({
      name: qbStarterName,
      value: qbStarterValue,
      rank: qbStarterPosRank,
    })}`,
    issues,
    passes,
  });
  addGate({
    condition: teRound != null && teRound <= 7,
    pass: "TE starter by round 7",
    issue: `TE starter too late: ${teRound ?? "missing"}`,
    issues,
    passes,
  });
  addGate({
    condition: !weakTeStarter || strongQbOffset,
    pass: weakTeStarter
      ? "TE starter weakness offset by tier-one QB"
      : "TE starter clears quality floor",
    issue: `TE starter below quality floor: ${formatStarter({
      name: teStarterName,
      value: teStarterValue,
      rank: teStarterPosRank,
      prefix: "TE",
    })}`,
    issues,
    passes,
  });
  addGate({
    condition: kRound != null && kRound >= rounds - 1,
    pass: "K in final two rounds",
    issue: `K too early: ${kRound ?? "missing"}`,
    issues,
    passes,
  });
  addGate({
    condition: defRound != null && defRound >= rounds - 1,
    pass: "DEF in final two rounds",
    issue: `DEF too early: ${defRound ?? "missing"}`,
    issues,
    passes,
  });

  return {
    positionSequence,
    qbRound,
    qbStarterName,
    qbStarterValue,
    qbStarterPosRank,
    teRound,
    teStarterName,
    teStarterValue,
    teStarterPosRank,
    rb2Round,
    wr2Round,
    kRound,
    defRound,
    issues,
    passes,
  };
}

function formatQbStarter(args: {
  name: string | null;
  value: number | null;
  rank: number | null;
}) {
  return formatStarter({ ...args, prefix: "QB" });
}

function formatStarter(args: {
  name: string | null;
  value: number | null;
  rank: number | null;
  prefix: string;
}) {
  const parts = [
    args.name ?? "missing",
    args.value == null ? null : `value ${args.value}`,
    args.rank == null ? null : `${args.prefix}${args.rank}`,
  ].filter((value): value is string => value != null);
  return parts.join(", ");
}

function addGate(args: {
  condition: boolean;
  pass: string;
  issue: string;
  issues: string[];
  passes: string[];
}) {
  if (args.condition) {
    args.passes.push(args.pass);
  } else {
    args.issues.push(args.issue);
  }
}

function starterCount(slots: SimRosterSlots) {
  return slots.QB + slots.RB + slots.WR + slots.TE + slots.K + slots.DEF + slots.FLEX;
}

function timestamp() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

function parseSlots(value: string | undefined, teams: number) {
  if (!value) return [Math.ceil(teams / 2)];
  if (value === "all") {
    return Array.from({ length: teams }, (_, index) => index + 1);
  }
  return value.split(",").flatMap((raw) => {
    const part = raw.trim();
    if (!part) return [];
    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-");
      const start = parseSlot(startRaw ?? "", teams);
      const end = parseSlot(endRaw ?? "", teams);
      if (end < start) throw new Error(`Invalid slot range ${part}.`);
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return [parseSlot(part, teams)];
  });
}

function parseSlot(value: string, teams: number) {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > teams) {
    throw new Error(`Invalid slot ${value}; expected 1-${teams}.`);
  }
  return slot;
}

function parseArgs(rawArgs: string[]): Args {
  const parsed: Args = {
    analyze: false,
    analyzeDelayMs: 20_000,
    analyzeSlots: "user",
    botStrategy: "sleeper-market-v1",
    draftType: "snake",
    outDir: "data/draft-results",
    rounds: 15,
    runs: 1,
    scoring: "std",
    seed: "algo-2026",
    teams: 10,
    rosterSlots: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      K: 1,
      DEF: 1,
      FLEX: 1,
    },
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg) continue;
    if (arg === "--") {
      continue;
    } else if (arg === "--analyze") {
      parsed.analyze = true;
    } else if (arg === "--analyze-slots") {
      parsed.analyzeSlots = requireArg(rawArgs, (index += 1), arg);
    } else if (arg === "--analyze-delay-ms") {
      parsed.analyzeDelayMs = parseNonNegativeInt(
        requireArg(rawArgs, (index += 1), arg),
        arg
      );
    } else if (arg === "--bot-strategy") {
      parsed.botStrategy = parseBotStrategy(
        requireArg(rawArgs, (index += 1), arg)
      );
    } else if (arg === "--draft-type") {
      parsed.draftType = parseDraftType(requireArg(rawArgs, (index += 1), arg));
    } else if (arg === "--fbg-env") {
      parsed.fbgEnv = requireArg(rawArgs, (index += 1), arg);
    } else if (arg === "--out-dir") {
      parsed.outDir = requireArg(rawArgs, (index += 1), arg);
    } else if (arg === "--rounds") {
      parsed.rounds = parsePositiveInt(requireArg(rawArgs, (index += 1), arg), arg);
    } else if (arg === "--runs") {
      parsed.runs = parsePositiveInt(requireArg(rawArgs, (index += 1), arg), arg);
    } else if (arg === "--scoring") {
      parsed.scoring = parseScoring(requireArg(rawArgs, (index += 1), arg));
    } else if (arg === "--seed") {
      parsed.seed = requireArg(rawArgs, (index += 1), arg);
    } else if (arg === "--slot" || arg === "--slots") {
      parsed.slotsArg = requireArg(rawArgs, (index += 1), arg);
    } else if (arg === "--teams") {
      parsed.teams = parsePositiveInt(requireArg(rawArgs, (index += 1), arg), arg);
    } else if (arg.startsWith("--slots-")) {
      setRosterSlot(parsed, arg, requireArg(rawArgs, (index += 1), arg));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function setRosterSlot(parsed: Args, arg: string, value: string) {
  const key = arg.replace("--slots-", "").toUpperCase();
  if (!isRosterSlotKey(key)) throw new Error(`Unknown roster slot flag: ${arg}`);
  parsed.rosterSlots[key] = parsePositiveInt(value, arg);
}

function isRosterSlotKey(value: string): value is keyof SimRosterSlots {
  return value === "QB" ||
    value === "RB" ||
    value === "WR" ||
    value === "TE" ||
    value === "K" ||
    value === "DEF" ||
    value === "FLEX";
}

function parseScoring(value: string): ScoringType {
  if (value === "std" || value === "half" || value === "ppr") return value;
  throw new Error(`Invalid scoring ${value}; expected std, half, or ppr.`);
}

function parseDraftType(value: string): SimDraftType {
  if (value === "snake" || value === "linear") return value;
  throw new Error(`Invalid draft type ${value}; expected snake or linear.`);
}

function parseBotStrategy(value: string): SimBotStrategyId {
  if (value === "sleeper-adp-needs" || value === "sleeper-market-v1") {
    return value;
  }
  throw new Error(
    `Invalid bot strategy ${value}; expected sleeper-adp-needs or sleeper-market-v1.`
  );
}

function parsePositiveInt(value: string, flag: string) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new Error(`Invalid ${flag}: ${value}.`);
  }
  return numeric;
}

function parseNonNegativeInt(value: string, flag: string) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`Invalid ${flag}: ${value}.`);
  }
  return numeric;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function requireArg(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
