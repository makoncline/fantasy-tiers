import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { ScoringType } from "../../src/lib/schemas";
import { POSITIONS_TO_SCORING_TYPES } from "../../src/lib/scoring";
import { tiersSourceUrl } from "../../src/lib/tiers";
import { fantasyProsExpertMetadata } from "../fp/fantasyprosExpertMetadata";

type OutputPosition =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DEF"
  | "FLEX"
  | "ALL";

type TierConfig = {
  limit: number;
  tierCount: number;
};

type TieredRow = {
  row: FantasyProsDraftRow;
  tier: number;
};

type CsvValue = string | number | null;
type CsvRow = Record<string, CsvValue>;

const numericField = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().nullable().optional()
);

const FantasyProsDraftRowSchema = z
  .object({
    player_name: z.string().min(1),
    player_positions: z.string().min(1),
    rank_ecr: numericField,
    rank_min: numericField,
    rank_max: numericField,
    rank_ave: numericField,
    rank_std: numericField,
  })
  .passthrough();

const FantasyProsDraftRawSchema = z
  .object({
    year: numericField,
    position_id: z.string().nullable().optional(),
    scoring: z.string().nullable().optional(),
    total_experts: numericField,
    last_updated_ts: numericField,
    accessed: z.string().nullable().optional(),
  })
  .passthrough();

const FantasyProsDraftFileSchema = z
  .object({
    raw: FantasyProsDraftRawSchema.optional(),
    rows: z.array(FantasyProsDraftRowSchema),
  })
  .passthrough();

type FantasyProsDraftFile = z.infer<typeof FantasyProsDraftFileSchema>;
export type FantasyProsDraftRow = z.infer<typeof FantasyProsDraftRowSchema>;

const TIER_CONFIGS: Record<
  OutputPosition,
  Partial<Record<ScoringType, TierConfig>>
> = {
  QB: { std: { limit: 26, tierCount: 8 } },
  RB: {
    std: { limit: 40, tierCount: 9 },
    ppr: { limit: 40, tierCount: 10 },
    half: { limit: 40, tierCount: 9 },
  },
  WR: {
    std: { limit: 60, tierCount: 12 },
    ppr: { limit: 60, tierCount: 12 },
    half: { limit: 60, tierCount: 10 },
  },
  TE: {
    std: { limit: 24, tierCount: 8 },
    ppr: { limit: 25, tierCount: 8 },
    half: { limit: 25, tierCount: 7 },
  },
  K: { std: { limit: 20, tierCount: 5 } },
  DEF: { std: { limit: 20, tierCount: 6 } },
  FLEX: {
    std: { limit: 95, tierCount: 14 },
    ppr: { limit: 95, tierCount: 14 },
    half: { limit: 95, tierCount: 15 },
  },
  ALL: {
    std: { limit: 200, tierCount: 26 },
    ppr: { limit: 200, tierCount: 26 },
    half: { limit: 200, tierCount: 26 },
  },
};

const OVERALL_SUBTIER_COUNTS = [10, 8, 8] as const;
const UPSTREAM_REFERENCE = "https://github.com/borisachen/fftiers";

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function primaryPosition(row: FantasyProsDraftRow): string {
  return row.player_positions.split(",")[0]?.trim().toUpperCase() ?? "";
}

function sourcePosition(outputPosition: OutputPosition): string | null {
  if (outputPosition === "ALL" || outputPosition === "FLEX") return null;
  if (outputPosition === "DEF") return "DST";
  return outputPosition;
}

function isEligibleForOutput(
  row: FantasyProsDraftRow,
  outputPosition: OutputPosition
): boolean {
  const position = primaryPosition(row);
  if (outputPosition === "ALL") return true;
  if (outputPosition === "FLEX") {
    return position === "RB" || position === "WR" || position === "TE";
  }
  return position === sourcePosition(outputPosition);
}

function rankSortValue(row: FantasyProsDraftRow): number | null {
  return finiteNumber(row.rank_ecr) ?? finiteNumber(row.rank_ave);
}

function tierValue(row: FantasyProsDraftRow, index: number): number {
  return finiteNumber(row.rank_ave) ?? finiteNumber(row.rank_ecr) ?? index + 1;
}

function compareRowsByRank(
  left: FantasyProsDraftRow,
  right: FantasyProsDraftRow
): number {
  const leftRank = rankSortValue(left) ?? Number.POSITIVE_INFINITY;
  const rightRank = rankSortValue(right) ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return tierValue(left, 0) - tierValue(right, 0);
}

function clusterSse(
  prefix: readonly number[],
  prefixSquares: readonly number[],
  start: number,
  end: number
): number {
  const count = end - start;
  if (count <= 0) return 0;
  const sum = prefix[end]! - prefix[start]!;
  const sumSquares = prefixSquares[end]! - prefixSquares[start]!;
  return sumSquares - (sum * sum) / count;
}

export function assignContiguousTiers(
  values: readonly number[],
  requestedTierCount: number
): number[] {
  const n = values.length;
  if (n === 0) return [];
  const distinctValueCount = new Set(values).size;
  const tierCount = Math.max(
    1,
    Math.min(Math.floor(requestedTierCount), n, distinctValueCount)
  );
  if (tierCount === 1) return Array.from({ length: n }, () => 1);

  const prefix = Array.from({ length: n + 1 }, () => 0);
  const prefixSquares = Array.from({ length: n + 1 }, () => 0);
  for (let index = 0; index < n; index += 1) {
    const value = values[index]!;
    prefix[index + 1] = prefix[index]! + value;
    prefixSquares[index + 1] = prefixSquares[index]! + value * value;
  }

  const dp = Array.from({ length: tierCount + 1 }, () =>
    Array.from({ length: n + 1 }, () => Number.POSITIVE_INFINITY)
  );
  const previous = Array.from({ length: tierCount + 1 }, () =>
    Array.from({ length: n + 1 }, () => -1)
  );
  dp[0]![0] = 0;

  for (let group = 1; group <= tierCount; group += 1) {
    for (let end = group; end <= n; end += 1) {
      for (let start = group - 1; start < end; start += 1) {
        const previousCost = dp[group - 1]![start]!;
        if (!Number.isFinite(previousCost)) continue;
        const cost =
          previousCost + clusterSse(prefix, prefixSquares, start, end);
        if (cost < dp[group]![end]!) {
          dp[group]![end] = cost;
          previous[group]![end] = start;
        }
      }
    }
  }

  const tiers = Array.from({ length: n }, () => 1);
  let end = n;
  for (let group = tierCount; group >= 1; group -= 1) {
    const start = previous[group]![end]!;
    if (start < 0) break;
    for (let index = start; index < end; index += 1) {
      tiers[index] = group;
    }
    end = start;
  }

  return tiers;
}

function attachTiers(
  rows: readonly FantasyProsDraftRow[],
  tierCount: number
): TieredRow[] {
  const values = rows.map((row, index) => tierValue(row, index));
  const tiers = assignContiguousTiers(values, tierCount);
  return rows.map((row, index) => ({
    row,
    tier: tiers[index] ?? 1,
  }));
}

function attachOverallTiers(rows: readonly FantasyProsDraftRow[]): TieredRow[] {
  const coarseTiers = attachTiers(rows, OVERALL_SUBTIER_COUNTS.length);
  const tieredRows: TieredRow[] = [];
  let nextTier = 1;

  for (
    let coarseTier = 1;
    coarseTier <= OVERALL_SUBTIER_COUNTS.length;
    coarseTier += 1
  ) {
    const groupRows = coarseTiers
      .filter((entry) => entry.tier === coarseTier)
      .map((entry) => entry.row);
    if (groupRows.length === 0) continue;

    const subtierCount = OVERALL_SUBTIER_COUNTS[coarseTier - 1]!;
    const subtiers = attachTiers(groupRows, subtierCount);
    const highestSubtier = Math.max(...subtiers.map((entry) => entry.tier));
    for (const entry of subtiers) {
      tieredRows.push({
        row: entry.row,
        tier: nextTier + entry.tier - 1,
      });
    }
    nextTier += highestSubtier;
  }

  return tieredRows;
}

function getTierConfig(
  outputPosition: OutputPosition,
  scoring: ScoringType
): TierConfig {
  const config = TIER_CONFIGS[outputPosition][scoring];
  if (!config) {
    throw new Error(
      `No tier generation config for ${outputPosition} ${scoring}`
    );
  }
  return config;
}

export function buildTierRows(
  rows: readonly FantasyProsDraftRow[],
  options: {
    outputPosition: OutputPosition;
    scoring: ScoringType;
    limit?: number;
    tierCount?: number;
  }
): CsvRow[] {
  const config = getTierConfig(options.outputPosition, options.scoring);
  const limit = options.limit ?? config.limit;
  const tierCount = options.tierCount ?? config.tierCount;
  const selectedRows = rows
    .filter((row) => isEligibleForOutput(row, options.outputPosition))
    .filter((row) => rankSortValue(row) != null)
    .toSorted(compareRowsByRank)
    .slice(0, limit);

  const tieredRows =
    options.outputPosition === "ALL"
      ? attachOverallTiers(selectedRows)
      : attachTiers(selectedRows, tierCount);

  return tieredRows.map(({ row, tier }, index) => {
    const base = {
      Rank: index + 1,
      "Player.Name": row.player_name,
      "Best.Rank": finiteNumber(row.rank_min),
      "Worst.Rank": finiteNumber(row.rank_max),
      "Avg.Rank": finiteNumber(row.rank_ave),
      "Std.Dev": finiteNumber(row.rank_std),
    } satisfies CsvRow;

    if (options.outputPosition === "ALL") {
      return {
        Rank: base.Rank,
        "Player.Name": base["Player.Name"],
        Tier: tier,
        Position: primaryPosition(row),
        "Best.Rank": base["Best.Rank"],
        "Worst.Rank": base["Worst.Rank"],
        "Avg.Rank": base["Avg.Rank"],
        "Std.Dev": base["Std.Dev"],
      } satisfies CsvRow;
    }

    return {
      Rank: base.Rank,
      "Player.Name": base["Player.Name"],
      Matchup: "",
      "Best.Rank": base["Best.Rank"],
      "Worst.Rank": base["Worst.Rank"],
      "Avg.Rank": base["Avg.Rank"],
      "Std.Dev": base["Std.Dev"],
      Tier: tier,
    } satisfies CsvRow;
  });
}

function csvEscape(value: CsvValue): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: readonly CsvRow[], header: readonly string[]): string {
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function readFantasyProsDraftFile(
  scoring: ScoringType
): Promise<{
  filePath: string;
  data: FantasyProsDraftFile;
}> {
  const filePath = path.resolve(
    "public",
    "data",
    "fantasypros",
    "raw",
    `ECR-ADP-${scoring}-draft_raw.json`
  );
  const text = await fs.readFile(filePath, "utf8");
  const json = JSON.parse(text);
  const parsed = FantasyProsDraftFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Invalid FantasyPros draft ECR file ${filePath}: ${parsed.error.message}`
    );
  }
  return { filePath, data: parsed.data };
}

function sourceUpdatedAt(data: FantasyProsDraftFile): string {
  const timestamp = finiteNumber(data.raw?.last_updated_ts);
  if (timestamp != null) return new Date(timestamp * 1000).toISOString();
  return new Date().toISOString();
}

async function writeTierOutput({
  sourceFile,
  sourceData,
  outputPosition,
  scoring,
  rows,
  generatedAt,
}: {
  sourceFile: string;
  sourceData: FantasyProsDraftFile;
  outputPosition: OutputPosition;
  scoring: ScoringType;
  rows: readonly CsvRow[];
  generatedAt: string;
}) {
  const outDir = path.resolve("public", "data", "tiers");
  await fs.mkdir(outDir, { recursive: true });

  const header =
    outputPosition === "ALL"
      ? [
          "Rank",
          "Player.Name",
          "Tier",
          "Position",
          "Best.Rank",
          "Worst.Rank",
          "Avg.Rank",
          "Std.Dev",
        ]
      : [
          "Rank",
          "Player.Name",
          "Matchup",
          "Best.Rank",
          "Worst.Rank",
          "Avg.Rank",
          "Std.Dev",
          "Tier",
        ];

  const csvPath = path.join(
    outDir,
    `${outputPosition}-${scoring}-rankings-raw.csv`
  );
  const metadataPath = path.join(
    outDir,
    `${outputPosition}-${scoring}-metadata.json`
  );
  const experts = fantasyProsExpertMetadata(sourceData.raw);
  await fs.writeFile(csvPath, toCsv(rows, header), "utf8");
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        lastUpdated: sourceUpdatedAt(sourceData),
        fetchedAt: generatedAt,
        source: "FantasyPros draft ECR tier generation",
        sourceUrl: tiersSourceUrl(outputPosition, scoring),
        referenceImplementation: UPSTREAM_REFERENCE,
        generatedFrom: path.relative(process.cwd(), sourceFile),
        algorithm:
          "Contiguous 1D k-means over FantasyPros Avg.Rank; ALL uses three coarse groups followed by 10/8/8 subtiers to mirror the fftiers predraft tier shape.",
        position: outputPosition,
        scoring,
        rowCount: rows.length,
        season: finiteNumber(sourceData.raw?.year),
        totalExperts: experts.included,
        experts,
      },
      null,
      2
    ),
    "utf8"
  );
}

export async function generateLocalTiers() {
  const generatedAt = new Date().toISOString();
  const sourceByScoring = new Map<
    ScoringType,
    Awaited<ReturnType<typeof readFantasyProsDraftFile>>
  >();

  for (const scoring of ["std", "half", "ppr"] satisfies ScoringType[]) {
    sourceByScoring.set(scoring, await readFantasyProsDraftFile(scoring));
  }

  for (const [position, scoringTypes] of Object.entries(
    POSITIONS_TO_SCORING_TYPES
  )) {
    for (const scoring of scoringTypes) {
      const outputPosition = position as OutputPosition;
      const source = sourceByScoring.get(scoring);
      if (!source) throw new Error(`Missing FantasyPros source for ${scoring}`);
      const rows = buildTierRows(source.data.rows, {
        outputPosition,
        scoring,
      });
      await writeTierOutput({
        sourceFile: source.filePath,
        sourceData: source.data,
        outputPosition,
        scoring,
        rows,
        generatedAt,
      });
      console.log(
        `Generated ${outputPosition} ${scoring} tiers from FantasyPros ECR (${rows.length} rows).`
      );
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  generateLocalTiers().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
