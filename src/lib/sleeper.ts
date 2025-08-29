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
