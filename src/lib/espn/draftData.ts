import { z } from "zod";
import { EspnRoomSchema } from "./schemas";

const DraftInit = z.object({
  id: z.number().int(), seasonId: z.number().int(),
  settings: z.object({ name: z.string(), draftSettings: z.object({ type: z.string(), leagueSubType: z.string().optional() }), scoringSettings: z.object({ playerRankType: z.string(), scoringItems: z.array(z.object({ statId: z.number().int(), points: z.number(), pointsOverrides: z.record(z.string(), z.number()).default({}) })) }) }),
  teams: z.array(z.object({ id: z.number().int(), name: z.string(), owners: z.array(z.string()).default([]) })),
  players: z.array(z.object({ player: z.object({
    id: z.number().int(), fullName: z.string(), defaultPositionId: z.number().int(), proTeamId: z.number().int(), eligibleSlots: z.array(z.number().int()), injuryStatus: z.string().optional(),
    draftRanksByRankType: z.record(z.string(), z.object({ rank: z.number().optional() })).optional(),
    ownership: z.object({ averageDraftPosition: z.number().optional() }).optional(),
    stats: z.array(z.object({ statSourceId: z.number(), statSplitTypeId: z.number(), externalId: z.union([z.string(), z.number()]), appliedTotal: z.number().optional() })).optional(),
  }) })),
});

export function normalizeEspnDraftData(input: unknown, leagueId: number, season: number) {
  const raw = DraftInit.parse(input);
  if (raw.id !== leagueId || raw.seasonId !== season) throw new Error("ESPN room identity changed.");
  return EspnRoomSchema.shape.data.unwrap().parse({
      observedAt: Date.now(), leagueId: raw.id, season: raw.seasonId, name: raw.settings.name,
      draftType: raw.settings.draftSettings.type, practice: raw.settings.draftSettings.leagueSubType === "CUSTOM_MOCK", rankType: raw.settings.scoringSettings.playerRankType,
      scoringItems: raw.settings.scoringSettings.scoringItems, teams: raw.teams.map(({ id, name }) => ({ id, name })),
      players: raw.players.map(({ player: p }) => ({ id: p.id, name: p.fullName, positionId: p.defaultPositionId, proTeamId: p.proTeamId, eligibleSlots: p.eligibleSlots, injuryStatus: p.injuryStatus, rank: p.draftRanksByRankType?.[raw.settings.scoringSettings.playerRankType]?.rank ?? null, adp: p.ownership?.averageDraftPosition ?? null, projected: p.stats?.find((s) => s.statSourceId === 1 && s.statSplitTypeId === 0 && String(s.externalId) === String(season))?.appliedTotal ?? null })),
    });
}
