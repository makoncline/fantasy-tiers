import { createHash } from "node:crypto";
import { z } from "zod";

// This boundary accepts platform facts only. It cannot read our draft strategy.
export const MarketPlayerSchema = z.object({
  id: z.string().min(1), name: z.string(),
  position: z.enum(["QB", "RB", "WR", "TE", "K", "DEF"]),
  rank: z.number().int().positive(),
});
export const MarketPoolSchema = z.array(MarketPlayerSchema).min(1);
export const MarketForecastInputSchema = z.object({
  players: MarketPoolSchema,
  pickedIds: z.array(z.string()),
  teams: z.number().int().min(2), rounds: z.number().int().positive(),
  ownerSlot: z.number().int().positive(),
  nextOwnPick: z.number().int().positive(),
  samples: z.number().int().min(1).max(4096), seed: z.string(),
});
export type MarketForecastInput = z.infer<typeof MarketForecastInputSchema>;

export function snakeSlot(pick: number, teams: number) {
  const offset = (pick - 1) % teams;
  return Math.floor((pick - 1) / teams) % 2 === 0 ? offset + 1 : teams - offset;
}

export function marketForecast(raw: MarketForecastInput) {
  const input = MarketForecastInputSchema.parse(raw);
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const picked = new Set(input.pickedIds);
  const startPick = input.pickedIds.length + 1;
  if (byId.size !== input.players.length || picked.size !== input.pickedIds.length ||
      input.pickedIds.some((id) => !byId.has(id))) throw new Error("The platform pool and prior picks must contain unique, known players.");
  if (input.ownerSlot > input.teams || input.nextOwnPick < startPick ||
      input.nextOwnPick > input.teams * input.rounds ||
      snakeSlot(input.nextOwnPick, input.teams) !== input.ownerSlot ||
      Array.from({ length: input.nextOwnPick - startPick }, (_, i) => startPick + i)
        .some((pick) => snakeSlot(pick, input.teams) === input.ownerSlot)) {
    throw new Error("Forecast only the opponents before the immediate next own pick.");
  }
  const available = input.players.filter((p) => !picked.has(p.id)).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const distance = input.nextOwnPick - startPick;
  if (available.length < distance) throw new Error("Not enough platform players for the forecast.");
  let state = createHash("sha256").update(input.seed).digest().readUInt32LE(0);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const selectedCounts = new Map(available.map((p) => [p.id, 0]));
  const sequences: string[][] = [];
  for (let sample = 0; sample < input.samples; sample++) {
    const pool = available.slice();
    const sequence: string[] = [];
    for (let n = 0; n < distance; n++) {
      // Fixed hypothesis: geometric offset, p=0.20, mean offset 4.
      // No position, phase, roster need, ECR, or owner limit enters this draw.
      const offset = Math.min(pool.length - 1, Math.floor(Math.log1p(-random()) / Math.log(0.8)));
      const player = pool.splice(offset, 1)[0]!;
      sequence.push(player.id);
      selectedCounts.set(player.id, selectedCounts.get(player.id)! + 1);
    }
    sequences.push(sequence);
  }
  return {
    model: "market-geometric-v1" as const, distance, sequences,
    survival: Object.fromEntries([...selectedCounts].map(([id, count]) => [id,
      distance === 0 ? 1 : (input.samples - count + 0.5) / (input.samples + 1)])),
  };
}

export function summarizeMarketGroup(forecast: ReturnType<typeof marketForecast>, ids: string[]) {
  if (ids.length === 0) return null;
  if (ids.some((id) => forecast.survival[id] == null)) throw new Error("Group includes an unavailable or unknown player.");
  const remaining = forecast.sequences.map((sequence) => ids.filter((id) => !sequence.includes(id)).length);
  return {
    ids,
    atLeastOne: forecast.distance === 0 ? 1 : (remaining.filter((n) => n > 0).length + 0.5) / (remaining.length + 1),
    expectedRemaining: remaining.reduce((sum, n) => sum + n, 0) / remaining.length,
    remainingRange: [Math.min(...remaining), Math.max(...remaining)],
  };
}
