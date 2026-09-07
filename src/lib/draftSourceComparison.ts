import { z } from "zod";
import { buildStarterAwareValues, calculateBeerPlusProjectedPoints, DraftProjectionStatsSchema } from "./beerPlusStrategy";
import { buildDraftValueBoard } from "./draftValue";
import type { DraftChoiceSnapshot } from "./draftChoices";
import { normalizePlayerName } from "./util";

export const ProjectionSourceSchema = z.object({
  updatedAt: z.string().nullable(),
  problems: z.array(z.string()),
  rows: z.array(z.object({ name: z.string(), position: z.enum(["QB", "RB", "WR", "TE"]), stats: DraftProjectionStatsSchema })),
});
export type ProjectionSource = z.infer<typeof ProjectionSourceSchema>;
const offense = new Set(["QB", "RB", "WR", "TE"]);

/** Full-pool projection ranks. Draft status and contextual scores do not affect rank. */
export function projectionPositionRanks(players: ReadonlyArray<{ playerId: string; position: string; projectedPoints: number }>) {
  const ranks: Record<string, number> = {};
  const positions = new Set(players.map(player => player.position));
  for (const position of positions) {
    const ordered = players.filter(player => player.position === position && Number.isFinite(player.projectedPoints))
      .sort((a, b) => b.projectedPoints - a.projectedPoints);
    let rank = 0;
    ordered.forEach((player, index) => {
      if (index === 0 || player.projectedPoints !== ordered[index - 1]?.projectedPoints) rank = index + 1;
      ranks[player.playerId] = rank;
    });
  }
  return ranks;
}

/** Recompute the same decision model with source-native points. Never mutate the active board. */
export function compareDraftSources(snapshot: DraftChoiceSnapshot, fp: ProjectionSource, now = Date.now()) {
  const players = snapshot.boardInput.players;
  const sleeperPoints = players.flatMap(player => {
    const points = (snapshot.sleeperValues ?? snapshot.values).valuesByPlayerId[player.player_id]?.rawProjectedPoints;
    return points == null ? [] : [{ playerId: player.player_id, position: player.position, projectedPoints: points, rawProjectedPoints: points }];
  });
  const indexed = new Map<string, ProjectionSource["rows"]>();
  for (const row of fp.rows) {
    const key = `${normalizePlayerName(row.name)}:${row.position}`;
    indexed.set(key, [...(indexed.get(key) ?? []), row]);
  }
  const fpPoints = players.flatMap(player => {
    if (["K", "DEF"].includes(player.position)) return sleeperPoints.filter(p => p.playerId === player.player_id);
    if (player.fp_rank_ave == null) return [];
    const matches = indexed.get(`${normalizePlayerName(player.name)}:${player.position}`);
    if (matches?.length !== 1) return [];
    const points = calculateBeerPlusProjectedPoints({ position: player.position, stats: matches[0]!.stats, scoringRules: snapshot.scoringRules });
    return [{ playerId: player.player_id, position: player.position, projectedPoints: points, rawProjectedPoints: points }];
  });
  const problems = [...fp.problems];
  const updated = Date.parse(fp.updatedAt ?? "");
  // Three days is an explicit data-age gate, not a forecast-confidence estimate.
  if (!Number.isFinite(updated) || now - updated > 72 * 3600_000 || updated > now + 86400_000) problems.push("FP projections are stale or undated.");
  const relevant = [...players].filter(p => offense.has(p.position) && p.fp_rank_ave != null)
    .sort((a,b) => (a.fp_rank_ave ?? Infinity) - (b.fp_rank_ave ?? Infinity)).slice(0, snapshot.boardInput.teams * (snapshot.boardInput.rounds ?? 14));
  const ids = new Set(fpPoints.map(p => p.playerId));
  const coverage = relevant.filter(p => ids.has(p.player_id)).length;
  if (coverage < relevant.length * 0.9) problems.push(`FP coverage ${coverage}/${relevant.length}; at least 90% required for baseline comparison.`);
  for (const position of ["QB", "RB", "WR", "TE"] as const) {
    const required = snapshot.rosterSlots[position] * snapshot.boardInput.teams;
    if (fpPoints.filter(p => p.position === position).length < required) problems.push(`FP ${position} depth is incomplete.`);
  }
  const calculate = (points: typeof sleeperPoints) => {
    const values = buildStarterAwareValues({ teams: snapshot.boardInput.teams, rosterSlots: snapshot.rosterSlots, players: points });
    const board = buildDraftValueBoard({ ...snapshot.boardInput, staticValuesByPlayerId: Object.fromEntries(Object.entries(values.valuesByPlayerId).map(([id,v]) => [id,v.value])) });
    return { values, board, positionRanksByPlayerId: projectionPositionRanks(points) };
  };
  return { sleeper: calculate(sleeperPoints), fp: problems.length ? null : calculate(fpPoints), problems, coverage, total: relevant.length };
}
