import { z } from "zod";

const Integer = z.number().int();
export const EspnPlayerSchema = z.object({
  id: Integer, name: z.string(), positionId: Integer, proTeamId: Integer,
  eligibleSlots: z.array(Integer), injuryStatus: z.string().optional(),
  rank: z.number().nullable(), adp: z.number().nullable(), projected: z.number().nullable(),
});
export const EspnRoomSchema = z.object({
  connected: z.boolean(), updatedAt: z.number(), error: z.string().nullable(),
  data: z.object({
    observedAt: z.number(), leagueId: Integer, season: Integer, name: z.string(), draftType: z.string(), practice: z.boolean(), rankType: z.string(),
    scoringItems: z.array(z.object({ statId: Integer, points: z.number(), pointsOverrides: z.record(z.string(), z.number()) })),
    teams: z.array(z.object({ id: Integer, name: z.string() })),
    players: z.array(EspnPlayerSchema),
  }).nullable(),
  live: z.object({
    leagueId: Integer, teamId: Integer, state: Integer, draftType: Integer,
    limits: z.array(z.object({ positionId: Integer, maximum: Integer })),
    slots: z.array(z.object({ id: Integer, category: Integer, positions: z.array(Integer) })),
    teams: z.array(z.object({ id: Integer, draftPosition: Integer })),
    picks: z.array(z.object({ teamId: Integer, pickNumber: Integer, playerId: Integer, slotId: Integer, keeper: z.boolean() })),
  }).nullable(),
}).superRefine((room, ctx) => {
  if (room.live && room.data && room.live.leagueId !== room.data.leagueId) ctx.addIssue({ code: "custom", message: "ESPN room identity mismatch" });
  if (room.live) {
    const numbers = room.live.picks.map((p) => p.pickNumber);
    if (new Set(numbers).size !== numbers.length) ctx.addIssue({ code: "custom", message: "Duplicate ESPN picks" });
  }
});
export type EspnRoom = z.infer<typeof EspnRoomSchema>;
export type EspnPlayer = z.infer<typeof EspnPlayerSchema>;

export const espnPositionNames: Record<number, string> = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST" };
export const espnSlotNames: Record<number, string> = { 0: "QB", 2: "RB", 4: "WR", 6: "TE", 16: "D/ST", 17: "K", 20: "Bench", 21: "IR", 23: "FLEX" };

export function espnRoomStatus(room: EspnRoom, now: number) {
  if (room.error) return room.error;
  if (!room.connected || now - room.updatedAt > 15000) return "Connection lost. Reconnect to the ESPN draft.";
  if (!room.live || !room.data) return "Waiting for ESPN data. Reconnect to the ESPN draft.";
  if (room.data.draftType !== "SNAKE") return "This screen supports snake drafts only.";
  return null;
}
