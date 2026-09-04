import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import {
  DEFAULT_DRAFT_ROSTER_SLOTS,
  DEFAULT_DRAFT_SCORING_RULES,
  calculateDraftRounds,
  rankingScoringFromRules,
} from "../../src/lib/draftLeagueConfig";
import {
  assessDraftReadiness,
  draftReadinessShardCountsFromBundle,
  DraftReadinessReportSchema,
  type DraftReadinessReport,
} from "../../src/lib/draftReadiness";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF", "FLEX"];

const FetchModeSchema = z.object({
  mode: z.string(),
  season: z.string().optional(),
});

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeReportAtomic(
  filePath: string,
  report: DraftReadinessReport
): void {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(report, null, 2), "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function appendGithubSummary(report: DraftReadinessReport): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const rows = Object.values(report.cohorts)
    .map(
      (cohort) =>
        `| ${cohort.label} | ${cohort.ready}/${cohort.total} | ${cohort.coveragePct}% | ${cohort.status} |`
    )
    .join("\n");
  const incidents = report.incidents
    .map((incident) => `- ${incident.message}`)
    .join("\n");
  fs.appendFileSync(
    summaryPath,
    `## Draft data readiness\n\nStatus: **${report.status}**  \nChecked: ${report.checkedAt}\n\n| Cohort | Ready | Coverage | Status |\n| --- | ---: | ---: | --- |\n${rows}\n\n${incidents}\n`,
    "utf8"
  );
}

export function validateAggregateFiles(root: string): DraftReadinessReport {
  const aggregateDir = path.join(root, "public/data/aggregate");
  const reportPath = path.join(aggregateDir, "quality-report.json");
  const fetchModePath = path.join(
    root,
    "public/data/fantasypros/raw/fetch-mode.json"
  );
  const previous = fs.existsSync(reportPath)
    ? DraftReadinessReportSchema.safeParse(readJson(reportPath)).data ?? null
    : null;
  const fetchMode = FetchModeSchema.parse(readJson(fetchModePath));
  for (const position of POSITIONS) {
    const filePath = path.join(
      aggregateDir,
      `${position}-combined-aggregate.json`
    );
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing aggregate file: ${path.basename(filePath)}`);
    }
  }

  const season = process.env.SEASON ?? fetchMode.season ?? "";
  const teams = 12;
  const rounds = calculateDraftRounds(DEFAULT_DRAFT_ROSTER_SLOTS);
  const scoring = rankingScoringFromRules(DEFAULT_DRAFT_SCORING_RULES);
  const bundle = buildAggregateBundle({
    scoring,
    teams,
    rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
  });
  const assessment = assessDraftReadiness({
    candidates: Object.values(draftCandidateMapFromBundle(bundle)),
    sourceHealth: bundle.sourceHealth ?? null,
    projectionArtifact: bundle.draftProjections,
    teams,
    rounds,
    scoring,
    scoringRules: DEFAULT_DRAFT_SCORING_RULES,
    rosterSlots: DEFAULT_DRAFT_ROSTER_SLOTS,
    mode: fetchMode.mode,
    season,
    shardCounts: draftReadinessShardCountsFromBundle(bundle),
    previous,
    requireAllShards: true,
  });
  writeReportAtomic(reportPath, assessment.report);
  appendGithubSummary(assessment.report);
  return assessment.report;
}

function main(): void {
  const root = path.resolve(__dirname, "../../");
  const report = validateAggregateFiles(root);
  for (const [position, count] of Object.entries(report.shards)) {
    console.log(`PASS ${position}: ${count} rows`);
  }
  for (const cohort of Object.values(report.cohorts)) {
    console.log(
      `${cohort.status.toUpperCase()} ${cohort.label}: ${cohort.ready}/${cohort.total} ready (${cohort.coveragePct}%)`
    );
  }
  for (const issue of report.playerIssues) {
    console.warn(
      `PLAYER ${issue.name} (${issue.position}): ${issue.problems.join(" ")}`
    );
  }
  if (report.incidents.length > 0) {
    for (const incident of report.incidents) {
      console.error(`BLOCKED ${incident.message}`);
    }
    process.exit(1);
  }
  console.log("Draft data is ready.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
