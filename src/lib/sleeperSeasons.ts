export type SleeperSeasonState = {
  season?: string | null | undefined;
  league_season?: string | null | undefined;
  league_create_season?: string | null | undefined;
  previous_season?: string | null | undefined;
};

function normalizeSeason(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const season = String(value).trim();
  return /^\d{4}$/.test(season) ? season : null;
}

export function getSleeperSeasonCandidates(
  state: SleeperSeasonState | null | undefined,
  fallbackYear: string = String(new Date().getFullYear())
): string[] {
  const candidates = [
    state?.league_season,
    state?.season,
    fallbackYear,
    state?.league_create_season,
  ];

  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    const season = normalizeSeason(candidate);
    if (!season || seen.has(season)) return [];
    seen.add(season);
    return [season];
  });
}
