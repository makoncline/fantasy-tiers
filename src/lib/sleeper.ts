import { z } from "zod";

export const SleeperUserSchema = z.object({
  username: z.string(),
  user_id: z.string(),
  display_name: z.string().optional(),
  avatar: z.string().optional(),
});
export type SleeperUser = z.infer<typeof SleeperUserSchema>;

export const SleeperDraftSummarySchema = z.object({
  draft_id: z.string(),
  type: z.string().optional().nullable(),
  status: z.string().optional(),
  season: z.string().optional(),
  sport: z.string().optional(),
  league_id: z.string().optional(),
  name: z.string().optional(),
  metadata: z
    .object({
      name: z.string().optional(),
      scoring_type: z.string().optional(),
      description: z.string().optional(),
      show_team_names: z.string().optional(),
    })
    .optional(),
  start_time: z.number().optional(),
  settings: z
    .object({
      teams: z.number().optional(),
      rounds: z.number().optional(),
      pick_timer: z.number().optional(),
    })
    .optional(),
});
export type SleeperDraftSummary = z.infer<typeof SleeperDraftSummarySchema>;

export async function fetchSleeperUserByUsername(
  username: string
): Promise<SleeperUser> {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch user for username: ${username}`);
  }
  return SleeperUserSchema.parse(await res.json());
}

export async function fetchDraftsForUser(
  userId: string
): Promise<SleeperDraftSummary[]> {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(userId)}/drafts`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch drafts for user: ${userId}`);
  }
  return z.array(SleeperDraftSummarySchema).parse(await res.json());
}

export async function fetchSleeperUserById(
  userId: string
): Promise<SleeperUser> {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(userId)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch user for id: ${userId}`);
  }
  return SleeperUserSchema.parse(await res.json());
}

export async function fetchDraftsForUserYear(
  userId: string,
  year: string
): Promise<SleeperDraftSummary[]> {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(
      userId
    )}/drafts/nfl/${encodeURIComponent(year)}`
  );
  if (!res.ok) {
    throw new Error(
      `Failed to fetch drafts for user: ${userId} in nfl/${year}`
    );
  }
  return z.array(SleeperDraftSummarySchema).parse(await res.json());
}

// Leagues for user/year
export const SleeperLeagueSchema = z.object({
  // Keep only absolutely-required fields as required; relax others
  league_id: z.string(),
  name: z.string(),
});
export type SleeperLeague = z.infer<typeof SleeperLeagueSchema>;

export async function fetchLeaguesForUserYear(
  userId: string,
  year: string
): Promise<SleeperLeague[]> {
  const url = `https://api.sleeper.app/v1/user/${encodeURIComponent(
    userId
  )}/leagues/nfl/${encodeURIComponent(year)}`;
  console.log("fetching leagues for user: ", url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch leagues for user: ${userId} in nfl/${year}`
    );
  }
  const json = await res.json();
  return z.array(SleeperLeagueSchema).parse(json);
}

// Projections
// Response example (trimmed) from https://api.sleeper.com/projections/nfl/2025
// [{
//   status: null,
//   date: null,
//   stats: { adp_half_ppr: 1.6, pts_ppr: 328.3, ... },
//   category: "proj",
//   last_modified: 1756367439893,
//   week: null,
//   sport: "nfl",
//   season_type: "regular",
//   season: "2025",
//   player: { first_name: "Ja'Marr", last_name: "Chase", position: "WR", team: "CIN", ... },
//   team: "CIN",
//   player_id: "7564",
//   updated_at: 1756367439893,
//   game_id: "season",
//   company: "rotowire",
//   opponent: null
// }]

const SleeperProjectionPlayerSchema = z.object({
  fantasy_positions: z.array(z.string()).optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  position: z.string().optional(),
  team: z.string().nullable().optional(),
  team_abbr: z.string().nullable().optional(),
  team_changed_at: z.union([z.number(), z.string()]).nullable().optional(),
  years_exp: z.number().optional(),
  news_updated: z.number().optional(),
  injury_body_part: z.string().nullable().optional(),
  injury_notes: z.string().nullable().optional(),
  injury_start_date: z.union([z.number(), z.string()]).nullable().optional(),
  injury_status: z.string().nullable().optional(),
  metadata: z
    .object({
      channel_id: z.string().optional(),
      rookie_year: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const SleeperProjectionSchema = z.object({
  status: z.string().nullable().optional(),
  date: z.union([z.string(), z.number()]).nullable().optional(),
  // Sleeper sometimes returns numeric fields as strings; accept both
  stats: z.record(z.string(), z.union([z.number(), z.string()])),
  category: z.string(),
  last_modified: z.number().optional(),
  week: z.union([z.number(), z.string()]).nullable().optional(),
  sport: z.string(),
  season_type: z.string(),
  season: z.string(),
  player: SleeperProjectionPlayerSchema,
  team: z.string().nullable().optional(),
  player_id: z.string(),
  updated_at: z.number().optional(),
  game_id: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  opponent: z.string().nullable().optional(),
});

export type SleeperProjection = z.infer<typeof SleeperProjectionSchema>;

export async function fetchSleeperProjections(
  season: string,
  opts?: {
    seasonType?: string;
    positions?: string[];
    orderBy?: string;
    week?: number | string;
    sport?: string; // default nfl
  }
): Promise<SleeperProjection[]> {
  const sport = opts?.sport ?? "nfl";
  const seasonType = opts?.seasonType ?? "regular";
  const positions = opts?.positions ?? ["DEF", "K", "QB", "RB", "TE", "WR"];
  const orderBy = opts?.orderBy ?? "adp_half_ppr";
  const base = `https://api.sleeper.com/projections/${encodeURIComponent(
    sport
  )}/${encodeURIComponent(season)}`;
  const params = new URLSearchParams();
  if (seasonType) params.set("season_type", seasonType);
  if (opts?.week != null) params.set("week", String(opts.week));
  for (const p of positions) params.append("position[]", p);
  if (orderBy) params.set("order_by", orderBy);
  const url = `${base}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch projections: ${res.status} ${res.statusText}`
    );
  }
  const json = await res.json();
  // Normalize numeric string stats and tolerate provider variances
  const arr: unknown[] = Array.isArray(json) ? json : [];
  return arr.map((it: unknown) => {
    const item = it as Record<string, unknown>;
    const stats =
      item?.stats && typeof item.stats === "object" ? item.stats : {};
    const normalizedStats: Record<string, number> = {};
    for (const [k, v] of Object.entries(stats)) {
      const n = typeof v === "string" ? Number(v) : v;
      normalizedStats[k] = typeof n === "number" && isFinite(n) ? n : 0;
    }
    return {
      status: item?.status ?? null,
      date: item?.date ?? null,
      stats: normalizedStats,
      category: item?.category ?? "proj",
      last_modified:
        typeof item?.last_modified === "number"
          ? item.last_modified
          : undefined,
      week: item?.week ?? null,
      sport: item?.sport ?? "nfl",
      season_type: item?.season_type ?? "regular",
      season: String(item?.season ?? season),
      player: {
        fantasy_positions:
          ((item?.player as Record<string, unknown>)
            ?.fantasy_positions as string[]) ?? [],
        first_name:
          ((item?.player as Record<string, unknown>)?.first_name as string) ??
          undefined,
        last_name:
          ((item?.player as Record<string, unknown>)?.last_name as string) ??
          undefined,
        position:
          ((item?.player as Record<string, unknown>)?.position as string) ??
          undefined,
        team:
          ((item?.player as Record<string, unknown>)?.team as string) ?? null,
        team_abbr:
          ((item?.player as Record<string, unknown>)?.team_abbr as string) ??
          null,
        team_changed_at:
          (item?.player as Record<string, unknown>)?.team_changed_at ?? null,
        years_exp:
          ((item?.player as Record<string, unknown>)?.years_exp as number) ??
          undefined,
        news_updated:
          (item as Record<string, unknown>)?.news_updated ?? undefined,
        injury_body_part:
          ((item as Record<string, unknown>)?.injury_body_part as string) ??
          null,
        injury_notes:
          ((item as Record<string, unknown>)?.injury_notes as string) ?? null,
        injury_start_date:
          (item?.player as Record<string, unknown>)?.injury_start_date ?? null,
        injury_status:
          (item?.player as Record<string, unknown>)?.injury_status ?? null,
        metadata: (item?.player as Record<string, unknown>)?.metadata ?? {},
      },
      team: item?.team ?? null,
      player_id: String(item?.player_id ?? ""),
      updated_at:
        typeof item?.updated_at === "number" ? item.updated_at : undefined,
      game_id: item?.game_id ?? null,
      company: item?.company ?? null,
      opponent: item?.opponent ?? null,
    } as SleeperProjection;
  });
}

// NFL state (season/week)
export const SleeperNflStateSchema = z.object({
  week: z.number(),
  leg: z.number().optional(),
  season: z.string(),
  season_type: z.string(),
  league_season: z.string().optional(),
  previous_season: z.string().optional(),
  season_start_date: z.string().optional(),
  display_week: z.number().optional(),
  league_create_season: z.string().optional(),
  season_has_scores: z.boolean().optional(),
});
export type SleeperNflState = z.infer<typeof SleeperNflStateSchema>;

export async function fetchSleeperNflState(): Promise<SleeperNflState> {
  const res = await fetch("https://api.sleeper.app/v1/state/nfl");
  if (!res.ok) {
    throw new Error(`Failed to fetch Sleeper NFL state: ${res.status}`);
  }
  const json = await res.json();
  return SleeperNflStateSchema.parse(json);
}

// Sleeper players meta (team, bye_week, etc.) from /v1/players/nfl
// Used to derive tm_bw column by joining on player_id
export const SleeperPlayersMetaSchema = z.record(
  z.string(),
  z
    .object({
      player_id: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      position: z.string().nullable().optional(),
      team: z.string().nullable().optional(),
      bye_week: z.union([z.string(), z.number()]).nullable().optional(),
    })
    .passthrough()
);

export type SleeperPlayersMeta = z.infer<typeof SleeperPlayersMetaSchema>;

export async function fetchSleeperPlayersMeta(): Promise<SleeperPlayersMeta> {
  const res = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!res.ok) {
    throw new Error(`Failed to fetch Sleeper players meta: ${res.status}`);
  }
  const json = await res.json();
  return SleeperPlayersMetaSchema.parse(json);
}
