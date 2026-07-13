import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  buildDraftDataQualityReport,
  DraftQualityMetadataSchema,
  DraftDataQualityReportSchema,
  type DraftDataQualityReport,
} from "../../src/lib/draftDataQuality";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF", "FLEX"] as const;

const FetchModeSchema = z.object({
  mode: z.string(),
  season: z.string().optional(),
});

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeReportAtomic(filePath: string, report: DraftDataQualityReport): void {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(report, null, 2), "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function appendGithubSummary(report: DraftDataQualityReport): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const rows = Object.entries(report.scoring)
    .map(
      ([scoring, quality]) =>
        `| ${scoring.toUpperCase()} | ${quality.ecrRows} | ${quality.sleeperAdpCovered}/${quality.topCandidates} | ${quality.tierCovered}/${quality.topCandidates} | ${quality.expertsIncluded ?? "-"}/${quality.expertsAvailable ?? "-"} |`
    )
    .join("\n");
  fs.appendFileSync(
    summaryPath,
    `## Draft data quality\n\nStatus: **${report.status}**  \nGenerated: ${report.generatedAt}\n\n| Scoring | FP ECR | Sleeper ADP | Tiers | Experts |\n| --- | ---: | ---: | ---: | ---: |\n${rows}\n\n${report.warnings.map((warning) => `- Warning: ${warning}`).join("\n")}\n`,
    "utf8"
  );
}

export function validateAggregateFiles(root: string): DraftDataQualityReport {
  const aggregateDir = path.join(root, "public/data/aggregate");
  const reportPath = path.join(aggregateDir, "quality-report.json");
  const fetchModePath = path.join(
    root,
    "public/data/fantasypros/raw/fetch-mode.json"
  );
  const metadataPath = path.join(aggregateDir, "metadata.json");
  const previous = fs.existsSync(reportPath)
    ? DraftDataQualityReportSchema.parse(readJson(reportPath))
    : null;
  const fetchMode = FetchModeSchema.parse(readJson(fetchModePath));
  const shards = Object.fromEntries(
    POSITIONS.map((position) => {
      const filePath = path.join(
        aggregateDir,
        `${position}-combined-aggregate.json`
      );
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing aggregate file: ${path.basename(filePath)}`);
      }
      return [position, readJson(filePath)];
    })
  );
  const report = buildDraftDataQualityReport({
    mode: fetchMode.mode,
    season: process.env.SEASON ?? fetchMode.season ?? "",
    generatedAt: new Date(),
    shards,
    metadata: DraftQualityMetadataSchema.parse(readJson(metadataPath)),
    previous,
  });
  writeReportAtomic(reportPath, report);
  appendGithubSummary(report);
  return report;
}

function main(): void {
  const root = path.resolve(__dirname, "../../");
  const report = validateAggregateFiles(root);
  for (const [position, count] of Object.entries(report.shards)) {
    console.log(`PASS ${position}: ${count} rows`);
  }
  for (const [scoring, quality] of Object.entries(report.scoring)) {
    console.log(
      `PASS ${scoring}: ${quality.ecrRows} ECR, ${quality.sleeperAdpCovered}/${quality.topCandidates} real ADP, ${quality.tierCovered}/${quality.topCandidates} tiers`
    );
  }
  report.warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
  if (report.errors.length > 0) {
    report.errors.forEach((error) => console.error(`BLOCKED ${error}`));
    process.exit(1);
  }
  console.log("All aggregate files passed semantic draft-data validation.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
