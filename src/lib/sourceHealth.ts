import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

import type { DraftProjectionArtifact } from "@/lib/beerPlusStrategy";
import type { DraftRosterSlots } from "@/lib/draftLeagueConfig";
import {
  DraftSourceManifestSchema,
  MIN_SLEEPER_MARKET_MATCH_PCT,
  MIN_SLEEPER_MARKET_PLAYERS,
} from "@/lib/draftSourceManifest";
import type { Position, ScoringType } from "@/lib/schemas";
import type { CombinedEntryT } from "@/lib/schemas-aggregates";

export type AggregateSourceStatus = "available" | "missing";

export type AggregateSourceHealthItem = {
  source: "Sleeper" | "FantasyPros";
  status: AggregateSourceStatus;
  season: string | null;
  lastUpdated: string | null;
  fetchedAt: string | null;
  rowCount: number | null;
  expertsIncluded: number | null;
  expertsAvailable: number | null;
  expertCoveragePct: number | null;
  problems: string[];
};

export type FantasyProsDraftSourcePlayer = {
  sourcePlayerId: string;
  name: string;
  normalizedName: string;
  position: Position;
  rankAve: number;
  rankPos: number | null;
  updatedAt: string | null;
};

export type SleeperDraftSourcePlayer = {
  playerId: string;
  name: string;
  normalizedName: string;
  position: Position;
  marketRank: number;
};

export type AggregateSourceHealth = {
  generatedAt: string;
  scoring: ScoringType;
  sources: AggregateSourceHealthItem[];
  fantasyProsPlayers: FantasyProsDraftSourcePlayer[];
  sleeperPlayers: SleeperDraftSourcePlayer[];
};

const MetadataRecordSchema = z.object({
  fetched_at: z.union([z.string(), z.number()]).nullable().optional(),
  last_updated: z.union([z.string(), z.number()]).nullable().optional(),
  row_count: z.number().nonnegative().nullable().optional(),
  year: z.union([z.string(), z.number()]).nullable().optional(),
  experts: z
    .object({
      included: z.number().int().nonnegative().nullable().optional(),
      available: z.number().int().nonnegative().nullable().optional(),
      coverage_pct: z.number().nonnegative().nullable().optional(),
    })
    .optional(),
});

const AggregateMetadataSchema = z.object({
  fp: z
    .record(z.string(), z.record(z.string(), MetadataRecordSchema))
    .optional(),
});

type MetadataRecord = z.infer<typeof MetadataRecordSchema>;

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readMetadata(): z.infer<typeof AggregateMetadataSchema> | null {
  try {
    return AggregateMetadataSchema.parse(
      readJson(path.resolve("public/data/aggregate/metadata.json"))
    );
  } catch {
    return null;
  }
}

function readSourceManifest() {
  try {
    return DraftSourceManifestSchema.parse(
      readJson(path.resolve("public/data/aggregate/draft-source-manifest.json"))
    );
  } catch {
    return null;
  }
}

function toIso(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const numeric =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  const date = new Date(numeric);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function oldestIso(
  records: readonly MetadataRecord[],
  key: "fetched_at" | "last_updated"
) {
  const values = records.map((record) => toIso(record[key]));
  if (values.length === 0 || values.some((value) => value == null)) return null;
  return values.filter((value): value is string => value != null).toSorted()[0] ?? null;
}

function weakestNumber(
  records: readonly MetadataRecord[],
  key: "included" | "available" | "coverage_pct"
) {
  const values = records.flatMap((record) => {
    const value = record.experts?.[key];
    return value == null ? [] : [value];
  });
  return values.length === 0 ? null : Math.min(...values);
}

export function buildFantasyProsSourceHealth(
  metadata: z.infer<typeof AggregateMetadataSchema> | null,
  scoring: ScoringType,
  rosterSlots: Pick<
    DraftRosterSlots,
    "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX"
  >,
  sourcePlayerCount: number
): AggregateSourceHealthItem {
  const scoringRecords = metadata?.fp?.[scoring.toUpperCase()] ?? {};
  const standardRecords = metadata?.fp?.STD ?? {};
  const required: Array<readonly [string, MetadataRecord | undefined]> = [];
  if (rosterSlots.QB > 0) required.push(["QB", standardRecords.QB]);
  if (rosterSlots.RB > 0 || rosterSlots.FLEX > 0) {
    required.push(["RB", scoringRecords.RB]);
  }
  if (rosterSlots.WR > 0 || rosterSlots.FLEX > 0) {
    required.push(["WR", scoringRecords.WR]);
  }
  if (rosterSlots.TE > 0 || rosterSlots.FLEX > 0) {
    required.push(["TE", scoringRecords.TE]);
  }
  if (rosterSlots.K > 0) required.push(["K", standardRecords.K]);
  if (rosterSlots.DEF > 0) required.push(["DST", standardRecords.DST]);
  if (rosterSlots.FLEX > 0) required.push(["FLEX", scoringRecords.FLEX]);
  const records = required.flatMap(([, record]) => (record ? [record] : []));
  const missingPositions = required.flatMap(([position, record]) =>
    record ? [] : [position]
  );
  const seasons = new Set(
    records.flatMap((record) =>
      record.year == null ? [] : [String(record.year)]
    )
  );
  const hasCompleteSeasonMetadata = records.every(
    (record) => record.year != null
  );
  const season =
    hasCompleteSeasonMetadata && seasons.size === 1
      ? [...seasons][0] ?? null
      : null;
  const fetchedAt = oldestIso(records, "fetched_at");
  const lastUpdated = oldestIso(records, "last_updated");
  const problems: string[] = [];
  if (missingPositions.length > 0) {
    problems.push(
      `FantasyPros metadata is missing for ${missingPositions.join(", ")}.`
    );
  }
  if (!fetchedAt) problems.push("FantasyPros fetch time is missing.");
  if (!lastUpdated) problems.push("FantasyPros source update time is missing.");
  if (!season) problems.push("FantasyPros season metadata is missing or mixed.");
  if (
    !records.every(
      (record) =>
        record.experts?.included != null &&
        record.experts.available != null &&
        record.experts.coverage_pct != null
    )
  ) {
    problems.push("FantasyPros expert metadata is incomplete.");
  }
  if (sourcePlayerCount === 0) {
    problems.push("FantasyPros draft player rows are missing.");
  }

  return {
    source: "FantasyPros",
    status: problems.length === 0 ? "available" : "missing",
    season,
    lastUpdated,
    fetchedAt,
    rowCount: records.reduce(
      (total, record) => total + (record.row_count ?? 0),
      0
    ),
    expertsIncluded: weakestNumber(records, "included"),
    expertsAvailable: weakestNumber(records, "available"),
    expertCoveragePct: weakestNumber(records, "coverage_pct"),
    problems,
  };
}

export function buildSleeperSourceHealth(args: {
  players: readonly CombinedEntryT[];
  projectionArtifact: DraftProjectionArtifact | null;
  market: {
    season: string;
    fetchedAt: string;
    rankedPlayerCount: number;
    matchedPlayerCount: number;
  } | null;
  marketPlayerCount: number;
  marketTopPlayerCount: number;
}): AggregateSourceHealthItem {
  const problems: string[] = [];
  if (args.players.length === 0) {
    problems.push("Sleeper aggregate rows are missing.");
  }
  if (!args.projectionArtifact) {
    problems.push("Sleeper projection data is missing.");
  }
  if (!args.market || args.marketPlayerCount === 0) {
    problems.push("Sleeper draft-market data is missing.");
  }
  if (args.market) {
    const matchPct =
      args.market.rankedPlayerCount === 0
        ? 0
        : (args.marketPlayerCount / args.market.rankedPlayerCount) * 100;
    if (
      args.market.rankedPlayerCount < MIN_SLEEPER_MARKET_PLAYERS ||
      args.marketPlayerCount < MIN_SLEEPER_MARKET_PLAYERS
    ) {
      problems.push(
        `Sleeper draft market has fewer than ${MIN_SLEEPER_MARKET_PLAYERS} ranked players.`
      );
    }
    const requiredTopCount = Math.min(120, args.market.rankedPlayerCount);
    if (args.marketTopPlayerCount !== requiredTopCount) {
      problems.push(
        `Sleeper draft market matches ${args.marketTopPlayerCount}/${requiredTopCount} core players; 100% is required.`
      );
    }
    if (matchPct < MIN_SLEEPER_MARKET_MATCH_PCT) {
      problems.push(
        `Sleeper draft-market player matching is ${matchPct.toFixed(1)}%; ` +
          `${MIN_SLEEPER_MARKET_MATCH_PCT}% is required.`
      );
    }
    if (args.market.matchedPlayerCount !== args.marketPlayerCount) {
      problems.push("Sleeper draft-market manifest counts do not match.");
    }
  }
  if (
    args.projectionArtifact &&
    args.market &&
    args.projectionArtifact.season !== args.market.season
  ) {
    problems.push("Sleeper projection and draft-market seasons do not match.");
  }
  if (args.projectionArtifact && !args.projectionArtifact.sourceLastModified) {
    problems.push("Sleeper source update time is missing.");
  }
  const seasons = [args.projectionArtifact?.season, args.market?.season].filter(
    (season): season is string => season != null
  );
  const season =
    seasons.length === 2 && new Set(seasons).size === 1
      ? seasons[0] ?? null
      : null;
  const fetchedAt = [
    args.projectionArtifact?.fetchedAt,
    args.market?.fetchedAt,
  ]
    .filter((value): value is string => value != null)
    .toSorted()[0] ?? null;
  return {
    source: "Sleeper",
    status: problems.length === 0 ? "available" : "missing",
    season,
    lastUpdated: args.projectionArtifact?.sourceLastModified ?? null,
    fetchedAt,
    rowCount: args.players.length,
    expertsIncluded: null,
    expertsAvailable: null,
    expertCoveragePct: null,
    problems,
  };
}

export function getAggregateSourceHealth(args: {
  scoring: ScoringType;
  players: readonly CombinedEntryT[];
  projectionArtifact: DraftProjectionArtifact | null;
  rosterSlots: Pick<
    DraftRosterSlots,
    "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX"
  >;
  now?: Date;
}): AggregateSourceHealth {
  const metadata = readMetadata();
  const sourceManifest = readSourceManifest();
  const sourcePlayers = sourceManifest?.fantasyPros[args.scoring] ?? [];
  const fantasyPros = buildFantasyProsSourceHealth(
    metadata,
    args.scoring,
    args.rosterSlots,
    sourcePlayers.length
  );
  const fantasyProsPlayers = sourcePlayers.map((player) => ({
    ...player,
    updatedAt: fantasyPros.lastUpdated,
  }));
  const sleeperPlayers = sourceManifest?.sleeper[args.scoring] ?? [];
  return {
    generatedAt: (args.now ?? new Date()).toISOString(),
    scoring: args.scoring,
    sources: [
      fantasyPros,
      buildSleeperSourceHealth({
        players: args.players,
        projectionArtifact: args.projectionArtifact,
        market: sourceManifest
          ? {
              season: sourceManifest.sleeperMarket.season,
              fetchedAt: sourceManifest.sleeperMarket.fetchedAt,
              ...sourceManifest.sleeperMarket.boards[args.scoring],
            }
          : null,
        marketPlayerCount: sleeperPlayers.length,
        marketTopPlayerCount: sleeperPlayers.filter(
          (player) => player.marketRank <= 120
        ).length,
      }),
    ],
    fantasyProsPlayers,
    sleeperPlayers,
  };
}
