import { z } from "zod";
import { normalizePlayerName } from "@/lib/util";
import type { PlayerRow } from "@/lib/playerRows";

// Coerce arbitrary player-like records (RankedPlayer / DraftedPlayer) into PlayerRow
const PlayerLikeSchema = z.object({
  player_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  position: z.string().optional(),
  pos: z.string().optional(),
  rank: z.union([z.number(), z.string()]).optional(),
  tier: z.union([z.number(), z.string()]).optional(),
  team: z.string().optional(),
  pro_team: z.string().optional(),
  nfl_team: z.string().optional(),
  bye_week: z.union([z.number(), z.string()]).optional(),
  bye: z.union([z.number(), z.string()]).optional(),
  player: z
    .object({
      id: z.string().optional(),
      full_name: z.string().optional(),
      position: z.string().optional(),
      rank: z.union([z.number(), z.string()]).optional(),
      tier: z.union([z.number(), z.string()]).optional(),
      team: z.string().optional(),
      bye_week: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

export function mapToPlayerRow(
  anyPlayers: unknown[],
  extrasByPlayerId?: Record<
    string,
    { val?: number; ps?: number; ecr_round_pick?: string }
  >
): PlayerRow[] {
  const arr = (Array.isArray(anyPlayers) ? anyPlayers : []).flatMap((p) => {
    const res = PlayerLikeSchema.safeParse(p);
    return res.success ? [res.data] : [];
  });
  return arr.map((p) => {
    const nested = p.player ?? {};
    const name =
      p.name ??
      p.full_name ??
      nested.full_name ??
      (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : "—");
    const pid = p.player_id ?? p.id ?? String(nested.id ?? "");
    const extrasById =
      extrasByPlayerId && pid ? extrasByPlayerId[pid] : undefined;
    const extrasByName =
      extrasByPlayerId && name
        ? extrasByPlayerId[normalizePlayerName(name)]
        : undefined;
    const extras = extrasById || extrasByName || {};
    const result: PlayerRow = {
      player_id: pid,
      name,
      position: (p.position ??
        p.pos ??
        nested.position ??
        "—") as PlayerRow["position"],
      team: p.team ?? p.pro_team ?? p.nfl_team ?? nested.team ?? "—",
      bye_week: (() => {
        const bye = p.bye_week ?? p.bye ?? nested.bye_week;
        if (typeof bye === "number") return bye;
        if (typeof bye === "string") {
          const parsed = Number(bye);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })(),
    };

    // Add optional properties only if they have valid values
    const rank = (() => {
      const r = p.rank ?? nested.rank;
      if (typeof r === "number") return r;
      if (typeof r === "string") {
        const parsed = Number(r);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    })();
    if (rank !== undefined) {
      result.rank = rank;
    }

    const tier = (() => {
      const t = p.tier ?? nested.tier;
      if (typeof t === "number") return t;
      if (typeof t === "string") {
        const parsed = Number(t);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    })();
    if (tier !== undefined) {
      result.tier = tier;
    }

    if (extras.ecr_round_pick) {
      result.ecr_round_pick = extras.ecr_round_pick;
    }
    if (extras.val !== undefined) {
      result.val = extras.val;
    }
    if (extras.ps !== undefined) {
      result.ps = extras.ps;
    }

    return result;
  });
}
