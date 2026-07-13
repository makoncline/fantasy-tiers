import { z } from "zod";

const DraftEcrRow = z.object({
  rank_ave: z.number().finite().nullable(),
});

const SleeperDraftRow = z.object({
  stats: z.object({
    adp_std: z.number().optional(),
    adp_half_ppr: z.number().optional(),
    adp_ppr: z.number().optional(),
  }),
});

export const DRAFT_ECR_MIN_ROWS = 300;
export const SLEEPER_MIN_ROWS = 2_500;
export const SLEEPER_MIN_REAL_ADP_ROWS = 150;

export function validateFantasyProsDraftRows(rows: unknown[]): void {
  const parsed = z.array(DraftEcrRow).parse(rows);
  const rankedRows = parsed.filter((row) => row.rank_ave !== null).length;

  if (parsed.length < DRAFT_ECR_MIN_ROWS) {
    throw new Error(
      `FantasyPros draft ECR response is too short: ${parsed.length} rows (minimum ${DRAFT_ECR_MIN_ROWS})`
    );
  }
  if (rankedRows < DRAFT_ECR_MIN_ROWS) {
    throw new Error(
      `FantasyPros draft ECR is missing rank_ave: ${rankedRows} ranked rows (minimum ${DRAFT_ECR_MIN_ROWS})`
    );
  }
}

function isRealAdp(value: number | undefined): boolean {
  return value !== undefined && value > 0 && value < 999;
}

export function validateSleeperDraftRows(
  rows: unknown[],
  season: string
): void {
  if (season !== "2026") {
    throw new Error(`Sleeper draft fetch must use season 2026, received ${season}`);
  }

  const parsed = z.array(SleeperDraftRow).parse(rows);
  const realAdpRows = parsed.filter((row) =>
    [
      row.stats.adp_std,
      row.stats.adp_half_ppr,
      row.stats.adp_ppr,
    ].some(isRealAdp)
  ).length;

  if (parsed.length < SLEEPER_MIN_ROWS) {
    throw new Error(
      `Sleeper draft response is too short: ${parsed.length} rows (minimum ${SLEEPER_MIN_ROWS})`
    );
  }
  if (realAdpRows < SLEEPER_MIN_REAL_ADP_ROWS) {
    throw new Error(
      `Sleeper draft response has too little real ADP: ${realAdpRows} rows (minimum ${SLEEPER_MIN_REAL_ADP_ROWS})`
    );
  }
}

export async function writeJsonAtomic(
  filePath: string,
  data: unknown
): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await import("node:fs/promises").then(async (fs) => {
    await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(temporaryPath, filePath);
  });
}
