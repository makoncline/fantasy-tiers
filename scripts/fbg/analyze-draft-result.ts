import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { DraftResultArtifactSchema } from "../../src/lib/draftResults";
import { DEFAULT_PLAYER_ID_CACHE_PATH } from "./player-id-cache";
import {
  resultDirDraftResult,
  writeFootballguysRequestFromDraftResult,
} from "./draft-result-request";

const execFileAsync = promisify(execFile);
const DEFAULT_DELAY_MS = 20_000;

type Args = {
  continueOnError?: boolean;
  delayMs: number;
  draftResult?: string;
  env?: string;
  idCache?: string;
  passingTouchdowns?: string;
  passingYards?: string;
  resultDir?: string;
  skipExisting?: boolean;
  slots?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const draftResultPath = args.draftResult ?? resultDirDraftResult(args.resultDir);
  if (!draftResultPath) {
    throw new Error("Provide --draft-result <path> or --result-dir <dir>.");
  }
  const resultDir = args.resultDir ?? path.dirname(draftResultPath);
  const artifact = DraftResultArtifactSchema.parse(
    JSON.parse(await readFile(draftResultPath, "utf8"))
  );
  const slotsArg = args.slots ?? "all";
  const slots = parseSlots(slotsArg, artifact.summary.teams);
  const idCachePath = args.idCache ?? DEFAULT_PLAYER_ID_CACHE_PATH;
  const reports = [];

  for (const slot of slots) {
    const reportPrefix = `footballguys-slot-${slot}`;
    const summaryPath = path.join(resultDir, `${reportPrefix}-summary.json`);
    if (args.skipExisting && (await fileExists(summaryPath))) {
      reports.push(await readSummary(slot, summaryPath));
      continue;
    }

    const request = await writeFootballguysRequestFromDraftResult({
      draftResultPath,
      passingTouchdowns: args.passingTouchdowns,
      passingYards: args.passingYards,
      slot,
    });

    try {
      await runRateTeam({
        env: args.env,
        idCache: idCachePath,
        input: request.outputPath,
        reportPrefix,
        resultDir,
      });
      reports.push(await readSummary(slot, summaryPath));
    } catch (error) {
      if (!args.continueOnError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      reports.push({ slot, ok: false, error: message });
      console.error(`Slot ${slot} failed: ${message}`);
    }

    if (args.delayMs > 0 && slot !== slots[slots.length - 1]) {
      await sleep(args.delayMs);
    }
  }

  const summaryPath = path.join(resultDir, summaryFileName(slotsArg, slots));
  const summary = {
    generatedAt: new Date().toISOString(),
    draftResultPath,
    idCachePath,
    slots,
    reports,
  };
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify({ summaryPath, reports }, null, 2));
}

async function runRateTeam(args: {
  env?: string | undefined;
  idCache: string;
  input: string;
  reportPrefix: string;
  resultDir: string;
}) {
  const commandArgs = [
    "--import=tsx",
    "scripts/fbg/rate-my-team.ts",
    "--input",
    args.input,
    "--result-dir",
    args.resultDir,
    "--report-prefix",
    args.reportPrefix,
    "--id-cache",
    args.idCache,
  ];
  if (args.env) {
    commandArgs.push("--env", args.env);
  }
  const { stdout, stderr } = await execFileAsync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    maxBuffer: 8 * 1024 * 1024,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function readSummary(slot: number, summaryPath: string) {
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as Record<
    string,
    unknown
  >;
  return { slot, ok: true, ...summary };
}

async function fileExists(filePath: string) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseSlots(value: string, teams: number) {
  if (value === "all") {
    return Array.from({ length: teams }, (_, index) => index + 1);
  }
  return value.split(",").map((raw) => {
    const slot = Number(raw.trim());
    if (!Number.isInteger(slot) || slot < 1 || slot > teams) {
      throw new Error(`Invalid slot ${raw}; expected 1-${teams}.`);
    }
    return slot;
  });
}

function summaryFileName(slotsArg: string, slots: number[]) {
  if (slotsArg === "all") return "footballguys-all-teams-summary.json";
  return `footballguys-slots-${slots.join("-")}-summary.json`;
}

function parseArgs(args: string[]): Args {
  const parsed: Args = {
    delayMs: DEFAULT_DELAY_MS,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--continue-on-error") {
      parsed.continueOnError = true;
    } else if (arg === "--delay-ms") {
      parsed.delayMs = parseNonNegativeInt(requireArg(args, (index += 1), arg), arg);
    } else if (arg === "--draft-result") {
      parsed.draftResult = requireArg(args, (index += 1), arg);
    } else if (arg === "--env") {
      parsed.env = requireArg(args, (index += 1), arg);
    } else if (arg === "--id-cache") {
      parsed.idCache = requireArg(args, (index += 1), arg);
    } else if (arg === "--passing-yards") {
      parsed.passingYards = requireArg(args, (index += 1), arg);
    } else if (arg === "--passing-touchdowns") {
      parsed.passingTouchdowns = requireArg(args, (index += 1), arg);
    } else if (arg === "--result-dir") {
      parsed.resultDir = requireArg(args, (index += 1), arg);
    } else if (arg === "--skip-existing") {
      parsed.skipExisting = true;
    } else if (arg === "--slots") {
      parsed.slots = requireArg(args, (index += 1), arg);
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function parseNonNegativeInt(value: string, flag: string) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`Invalid ${flag}: ${value}; expected a non-negative integer.`);
  }
  return numeric;
}

function requireArg(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
