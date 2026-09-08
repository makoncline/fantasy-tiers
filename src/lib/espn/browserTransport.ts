import { z } from "zod";
import { EspnRoomSchema } from "./schemas";

export const BrowserDraftSchema = z.object({
  room: EspnRoomSchema.nullable(),
  message: z.string().nullable(),
  receivedAt: z.number().nonnegative(),
});
export type BrowserDraft = z.infer<typeof BrowserDraftSchema>;
export const SourceSnapshotSchema = z.object({
  type: z.literal("source-room"), instanceId: z.string().uuid(),
  revision: z.number().int().positive(), room: EspnRoomSchema,
});
export const DraftIdentitySchema = z.object({ leagueId: z.number().int().positive(), season: z.number().int().min(2020), teamId: z.number().int().positive() });
export function draftIdentity(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    if (url.origin !== "https://fantasy.espn.com" || url.pathname !== "/football/draft") return null;
    const result = DraftIdentitySchema.safeParse({ leagueId: Number(url.searchParams.get("leagueId")), season: Number(url.searchParams.get("seasonId")), teamId: Number(url.searchParams.get("teamId")) });
    return result.success ? result.data : null;
  } catch { return null; }
}
export function isAssistantUrl(value: string | undefined, origin: string) {
  try { const url = new URL(value ?? ""); return url.origin === origin && url.pathname === "/espn-draft"; }
  catch { return false; }
}
