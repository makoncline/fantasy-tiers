import { z } from "zod";

const nullableNumber = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().nullable().optional()
);

const FantasyProsExpertsAvailableSchema = z
  .object({
    total: nullableNumber,
    included: z.array(z.coerce.number()).nullable().optional(),
    excluded: z.array(z.coerce.number()).nullable().optional(),
    last_update: nullableNumber,
  })
  .passthrough();

const FantasyProsRawExpertSchema = z
  .object({
    filters: z.unknown().optional(),
    total_experts: nullableNumber,
    experts_available: FantasyProsExpertsAvailableSchema.nullable().optional(),
  })
  .passthrough();

const StoredExpertMetadataSchema = z
  .object({
    included: nullableNumber,
    available: nullableNumber,
    coverage_pct: nullableNumber,
    included_ids: z.unknown().optional(),
    excluded_ids: z.unknown().optional(),
    filter_ids: z.unknown().optional(),
    last_updated: z.string().nullable().optional(),
  })
  .passthrough();

export type ExpertSampleSize = "unknown" | "thin" | "limited" | "normal";

export type ExpertSampleMetadata = {
  included: number | null;
  available: number | null;
  coverage_pct: number | null;
  included_ids: number[];
  excluded_ids: number[];
  filter_ids: number[];
  last_updated: string | null;
  sample_size: ExpertSampleSize;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueFiniteNumbers(values: readonly unknown[]): number[] {
  const ids = new Set<number>();
  for (const value of values) {
    const id = Number(value);
    if (Number.isFinite(id)) ids.add(id);
  }
  return [...ids];
}

function parseExpertIds(value: unknown): number[] {
  if (Array.isArray(value)) return uniqueFiniteNumbers(value);
  if (typeof value === "string") {
    return uniqueFiniteNumbers(
      value
        .split(/[,:]/)
        .map((part) => part.trim())
        .filter(Boolean)
    );
  }
  return [];
}

function isoFromUnixishSeconds(value: unknown): string | null {
  const n = finiteNumber(value);
  if (n == null) return null;
  const millis = n > 100_000_000_000 ? n : n * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function expertSampleSize(
  includedExpertCount: number | null
): ExpertSampleSize {
  if (includedExpertCount == null) return "unknown";
  if (includedExpertCount < 10) return "thin";
  if (includedExpertCount < 30) return "limited";
  return "normal";
}

function coveragePct(included: number | null, available: number | null) {
  if (included == null || available == null || available <= 0) return null;
  return Math.round((included / available) * 1000) / 10;
}

function emptyExpertMetadata(): ExpertSampleMetadata {
  return {
    included: null,
    available: null,
    coverage_pct: null,
    included_ids: [],
    excluded_ids: [],
    filter_ids: [],
    last_updated: null,
    sample_size: "unknown",
  };
}

export function fantasyProsExpertMetadata(
  raw: unknown,
  fallbackIncluded?: number | null
): ExpertSampleMetadata {
  const parsed = FantasyProsRawExpertSchema.safeParse(raw);
  if (!parsed.success) return emptyExpertMetadata();

  const availableRaw = parsed.data.experts_available ?? null;
  const includedIds = parseExpertIds(availableRaw?.included);
  const excludedIds = parseExpertIds(availableRaw?.excluded);
  const filterIds = parseExpertIds(parsed.data.filters);
  const fallback = finiteNumber(fallbackIncluded);
  const totalExperts = finiteNumber(parsed.data.total_experts);
  const included =
    totalExperts ?? (includedIds.length > 0 ? includedIds.length : fallback);
  const available =
    finiteNumber(availableRaw?.total) ??
    (includedIds.length + excludedIds.length > 0
      ? includedIds.length + excludedIds.length
      : null);

  return {
    included,
    available,
    coverage_pct: coveragePct(included, available),
    included_ids: includedIds,
    excluded_ids: excludedIds,
    filter_ids: filterIds,
    last_updated: isoFromUnixishSeconds(availableRaw?.last_update),
    sample_size: expertSampleSize(included),
  };
}

export function normalizeExpertSampleMetadata(
  value: unknown
): ExpertSampleMetadata {
  const parsed = StoredExpertMetadataSchema.safeParse(value);
  if (!parsed.success) return emptyExpertMetadata();

  const included = finiteNumber(parsed.data.included);
  const available = finiteNumber(parsed.data.available);
  const explicitCoverage = finiteNumber(parsed.data.coverage_pct);

  return {
    included,
    available,
    coverage_pct: explicitCoverage ?? coveragePct(included, available),
    included_ids: parseExpertIds(parsed.data.included_ids),
    excluded_ids: parseExpertIds(parsed.data.excluded_ids),
    filter_ids: parseExpertIds(parsed.data.filter_ids),
    last_updated: parsed.data.last_updated ?? null,
    sample_size: expertSampleSize(included),
  };
}
