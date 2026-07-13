import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import { FootballguysExperimentManifestSchema } from "../../src/lib/footballguysExperiments";

const execFileAsync = promisify(execFile);
const ProgressSchema = z.object({
  experimentId: z.string(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cases: z.record(
    z.string(),
    z.object({
      status: z.enum(["complete", "failed"]),
      finishedAt: z.string().datetime(),
      summaryPath: z.string().optional(),
      error: z.string().optional(),
    })
  ),
});

void main();

async function main() {
  const manifestPath = argument("--manifest");
  if (!manifestPath) throw new Error("Provide --manifest <experiment.json>");
  const manifest = FootballguysExperimentManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8"))
  );
  const outputDir = path.resolve(
    "data/draft-results/footballguys-experiments",
    manifest.experimentId
  );
  await mkdir(outputDir, { recursive: true });
  const progressPath = path.join(outputDir, "experiment-progress.json");
  const progress = await loadProgress(progressPath, manifest.experimentId);

  for (const [index, experimentCase] of manifest.cases.entries()) {
    if (progress.cases[experimentCase.id]?.status === "complete") continue;
    const caseDir = path.join(outputDir, experimentCase.id);
    await mkdir(caseDir, { recursive: true });
    const request = JSON.parse(await readFile(experimentCase.requestPath, "utf8"));
    const uniqueRequest = withUniqueNames(
      request,
      `${manifest.experimentId}-${experimentCase.id}`
    );
    const requestPath = path.join(caseDir, "request.json");
    await writeFile(requestPath, `${JSON.stringify(uniqueRequest, null, 2)}\n`);
    const reportPrefix = `case-${experimentCase.id}`;
    try {
      await execFileAsync(
        process.execPath,
        [
          "--import=tsx",
          "scripts/fbg/rate-my-team.ts",
          "--input",
          requestPath,
          "--result-dir",
          caseDir,
          "--report-prefix",
          reportPrefix,
        ],
        { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
      );
      progress.cases[experimentCase.id] = {
        status: "complete",
        finishedAt: new Date().toISOString(),
        summaryPath: path.join(caseDir, `${reportPrefix}-summary.json`),
      };
    } catch (error) {
      progress.cases[experimentCase.id] = {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
    progress.updatedAt = new Date().toISOString();
    await writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
    if (index < manifest.cases.length - 1) await delay(manifest.delayMs);
  }
  console.log(JSON.stringify({ outputDir, progressPath, progress }, null, 2));
}

async function loadProgress(filePath: string, experimentId: string) {
  try {
    return ProgressSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
  } catch {
    const now = new Date().toISOString();
    return ProgressSchema.parse({ experimentId, startedAt: now, updatedAt: now, cases: {} });
  }
}

function withUniqueNames(request: unknown, suffix: string) {
  const schema = z.object({
    manualEntryFields: z.object({ leagueName: z.string(), teamName: z.string() }).passthrough(),
  }).passthrough();
  const parsed = schema.parse(request);
  return {
    ...parsed,
    manualEntryFields: {
      ...parsed.manualEntryFields,
      leagueName: `${parsed.manualEntryFields.leagueName} ${suffix}`,
      teamName: `${parsed.manualEntryFields.teamName} ${suffix}`,
    },
  };
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
