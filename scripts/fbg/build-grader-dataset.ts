import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { glob } from "glob";
import { z } from "zod";

import { DraftResultArtifactSchema } from "../../src/lib/draftResults";
import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import type { AggregatesBundlePlayerT } from "../../src/lib/schemas-bundle";

const GradeSchema = z.enum([
  "F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+",
]);
const SummarySchema = z
  .object({
    overallGrade: GradeSchema.nullable().optional(),
    positionGrades: z.array(z.string()).optional().default([]),
  })
  .passthrough();
const GRADE_SCORE = {
  "F": 0, "D-": 1, "D": 2, "D+": 3, "C-": 4, "C": 5, "C+": 6,
  "B-": 7, "B": 8, "B+": 9, "A-": 10, "A": 11, "A+": 12,
} satisfies Record<z.infer<typeof GradeSchema>, number>;

void main();

async function main() {
  const currentBundle = buildAggregateBundle({
    scoring: "ppr",
    teams: 12,
    rosterSlots: { QB: 1, RB: 2, WR: 3, TE: 1, K: 1, DEF: 1, FLEX: 1, BENCH: 6 },
  });
  const currentFbgBySleeperId = new Map(
    currentBundle.shards.ALL.flatMap((player) =>
      player.footballguys
        ? [[player.player_id, player.footballguys] as const]
        : []
    )
  );
  const currentEcrBySleeperId = new Map(
    currentBundle.shards.ALL.flatMap((player) =>
      typeof player.fantasypros.ecr_average === "number"
        ? [[player.player_id, player.fantasypros.ecr_average] as const]
        : []
    )
  );
  const summaryFiles = await glob(
    "data/draft-results/**/footballguys-slot-*-summary.json",
    { nodir: true }
  );
  const byRoster = new Map<string, DatasetRow>();
  for (const summaryPath of summaryFiles.sort()) {
    const slot = Number(path.basename(summaryPath).match(/slot-(\d+)-summary/)?.[1]);
    if (!Number.isInteger(slot)) continue;
    const draftResultPath = path.join(path.dirname(summaryPath), "draft-result.json");
    let artifact;
    try {
      artifact = DraftResultArtifactSchema.parse(
        JSON.parse(await readFile(draftResultPath, "utf8"))
      );
    } catch {
      continue;
    }
    const summary = SummarySchema.parse(
      JSON.parse(await readFile(summaryPath, "utf8"))
    );
    const grade = summary.overallGrade ?? null;
    if (grade == null) continue;
    const gradeScore = GRADE_SCORE[grade];
    const roster = artifact.players.rostersBySlot[String(slot)] ?? [];
    if (roster.length === 0) continue;
    const rosterHash = hash(
      roster.map((player) => player.player_id).sort().join("|")
    );
    const row: DatasetRow = {
      rosterHash,
      draftId: artifact.summary.draftId,
      draftResultPath,
      summaryPath,
      slot,
      grade,
      gradeScore,
      positionGradeScores: parsePositionGrades(summary.positionGrades),
      features: rosterFeatures(
        artifact,
        roster,
        slot,
        currentFbgBySleeperId,
        currentEcrBySleeperId
      ),
    };
    byRoster.set(`${rosterHash}|${artifact.summary.scoring}|${artifact.summary.teams}`, row);
  }

  const rows = [...byRoster.values()];
  const datasetPath = "data/draft-results/footballguys-grader-dataset.json";
  await writeFile(
    datasetPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`
  );
  const evaluation = evaluateKnn(rows);
  const evaluationPath = "data/draft-results/footballguys-surrogate-evaluation.json";
  await writeFile(
    evaluationPath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      model: "evaluation-only 7-nearest-neighbor ordinal grade predictor",
      warning: "Do not use as draft recommendation truth; this only estimates external grades for faster experiments.",
      ...evaluation,
    }, null, 2)}\n`
  );
  console.log(JSON.stringify({ datasetPath, evaluationPath, rows: rows.length, evaluation }, null, 2));
}

type DatasetRow = {
  rosterHash: string;
  draftId: string;
  draftResultPath: string;
  summaryPath: string;
  slot: number;
  grade: string;
  gradeScore: number;
  positionGradeScores: Partial<Record<"QB" | "RB" | "WR" | "TE", number>>;
  features: Record<string, number>;
};

function rosterFeatures(
  artifact: z.infer<typeof DraftResultArtifactSchema>,
  roster: z.infer<typeof DraftResultArtifactSchema>["players"]["userRoster"],
  slot: number,
  currentFbgBySleeperId: ReadonlyMap<
    string,
    NonNullable<AggregatesBundlePlayerT["footballguys"]>
  >,
  currentEcrBySleeperId: ReadonlyMap<string, number>
) {
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF"];
  const features: Record<string, number> = {
    slot: slot / artifact.summary.teams,
    rosterSize: roster.length,
    teams: artifact.summary.teams,
    scoringStd: artifact.summary.scoring === "std" ? 1 : 0,
    scoringHalf: artifact.summary.scoring === "half" ? 1 : 0,
    scoringPpr: artifact.summary.scoring === "ppr" ? 1 : 0,
    requiredQB: artifact.state.config.rosterSlots.QB,
    requiredRB: artifact.state.config.rosterSlots.RB,
    requiredWR: artifact.state.config.rosterSlots.WR,
    requiredTE: artifact.state.config.rosterSlots.TE,
    requiredFLEX: artifact.state.config.rosterSlots.FLEX,
  };
  for (const position of positions) {
    const players = roster.filter((player) => player.position === position);
    const ecrs = players.flatMap((player) =>
      typeof player.fp_rank_ave === "number"
        ? [player.fp_rank_ave]
        : currentEcrBySleeperId.has(player.player_id)
          ? [currentEcrBySleeperId.get(player.player_id) ?? 400]
          : []
    );
    const fbgRanks = players.flatMap((player) => {
      const rank =
        typeof player.fbg_rank === "number"
          ? player.fbg_rank
          : currentFbgBySleeperId.get(player.player_id)?.rank;
      return typeof rank === "number" ? [rank] : [];
    });
    features[`count_${position}`] = players.length;
    features[`bestEcr_${position}`] = ecrs.length ? Math.min(...ecrs) : 400;
    features[`meanEcr_${position}`] = ecrs.length
      ? ecrs.reduce((sum, value) => sum + value, 0) / ecrs.length
      : 400;
    features[`bestCurrentFbgRank_${position}`] = fbgRanks.length
      ? Math.min(...fbgRanks)
      : 600;
    features[`meanCurrentFbgRank_${position}`] = fbgRanks.length
      ? fbgRanks.reduce((sum, value) => sum + value, 0) / fbgRanks.length
      : 600;
  }
  return features;
}

function evaluateKnn(rows: DatasetRow[]) {
  const predictions = [];
  for (const target of rows) {
    const holdout = split(target.draftId) === 0;
    if (!holdout) continue;
    const training = rows.filter((row) => split(row.draftId) !== 0);
    if (training.length === 0) continue;
    const neighbors = training
      .map((row) => ({ row, distance: featureDistance(target.features, row.features) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 7);
    const predicted = neighbors.reduce((sum, item) => sum + item.row.gradeScore, 0) / neighbors.length;
    predictions.push({
      draftId: target.draftId,
      slot: target.slot,
      actual: target.gradeScore,
      predicted: Math.round(predicted * 10) / 10,
      error: Math.abs(predicted - target.gradeScore),
    });
  }
  return {
    trainingRows: rows.filter((row) => split(row.draftId) !== 0).length,
    holdoutRows: predictions.length,
    meanAbsoluteError: predictions.length
      ? Math.round((predictions.reduce((sum, prediction) => sum + prediction.error, 0) / predictions.length) * 100) / 100
      : null,
    withinOneGradeStepPct: predictions.length
      ? Math.round((predictions.filter((prediction) => prediction.error <= 1).length / predictions.length) * 1000) / 10
      : null,
    predictions,
    positionModels: {
      QB: evaluatePosition(rows, "QB"),
      RB: evaluatePosition(rows, "RB"),
      WR: evaluatePosition(rows, "WR"),
      TE: evaluatePosition(rows, "TE"),
    },
  };
}

function evaluatePosition(
  rows: DatasetRow[],
  position: "QB" | "RB" | "WR" | "TE"
) {
  const predictions = [];
  for (const target of rows) {
    const actual = target.positionGradeScores[position];
    if (split(target.draftId) !== 0 || actual == null) continue;
    const neighbors = rows
      .filter(
        (row) =>
          split(row.draftId) !== 0 && row.positionGradeScores[position] != null
      )
      .map((row) => ({
        row,
        distance: featureDistance(target.features, row.features),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 7);
    if (neighbors.length === 0) continue;
    const predicted =
      neighbors.reduce(
        (sum, neighbor) =>
          sum + (neighbor.row.positionGradeScores[position] ?? 0),
        0
      ) / neighbors.length;
    predictions.push({ actual, error: Math.abs(predicted - actual) });
  }
  return {
    holdoutRows: predictions.length,
    meanAbsoluteError: predictions.length
      ? Math.round(
          (predictions.reduce((sum, prediction) => sum + prediction.error, 0) /
            predictions.length) *
            100
        ) / 100
      : null,
    withinOneGradeStepPct: predictions.length
      ? Math.round(
          (predictions.filter((prediction) => prediction.error <= 1).length /
            predictions.length) *
            1000
        ) / 10
      : null,
  };
}

function parsePositionGrades(values: readonly string[]) {
  const result: Partial<Record<"QB" | "RB" | "WR" | "TE", number>> = {};
  const labels = {
    Quarterback: "QB",
    "Running Back": "RB",
    "Wide Receiver": "WR",
    "Tight End": "TE",
  } as const;
  for (const value of values) {
    for (const [label, position] of Object.entries(labels)) {
      const match = value.match(new RegExp(`^${label} Starters ([A-F][+-]?)$`));
      if (!match?.[1]) continue;
      const grade = GradeSchema.safeParse(match[1]);
      if (grade.success) result[position] = GRADE_SCORE[grade.data];
    }
  }
  return result;
}

function featureDistance(a: Record<string, number>, b: Record<string, number>) {
  return Math.sqrt(
    Object.keys(a).reduce((sum, key) => {
      const scale = key.includes("Ecr")
        ? 100
        : key.includes("FbgRank")
          ? 150
          : key === "slot"
            ? 1
            : key === "teams"
              ? 4
              : 5;
      return sum + Math.pow(((a[key] ?? 0) - (b[key] ?? 0)) / scale, 2);
    }, 0)
  );
}

function split(value: string) {
  return Number.parseInt(hash(value).slice(0, 8), 16) % 5;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
