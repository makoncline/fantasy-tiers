import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { z } from "zod";
import { normalizePlayerName } from "@/lib/util";

export type PlayerRow = {
  player_id: string;
  name: string;
  position: string;
  rank?: number | string;
  tier?: number | string;
  team?: string;
  bye_week?: number | string;
  // Enriched fields (optional)
  bc_rank?: number | null;
  bc_tier?: number | null;
  sleeper_pts?: number | null;
  sleeper_adp?: number | null;
  sleeper_rank_overall?: number | null;
  fp_pts?: number | null;
  fp_adp?: number | null;
  fp_rank_overall?: number | null;
  fp_rank_pos?: number | null;
  fp_tier?: number | null;
  fp_baseline_pts?: number | null;
  fp_value?: number | null;
  fp_positional_scarcity_slope?: number | null;
  fp_player_owned_avg?: number | null;
  market_delta?: number | null;
};

export function PlayerTable({
  rows,
  renderActions,
  sortable = false,
}: {
  rows: PlayerRow[];
  renderActions?: (row: PlayerRow) => React.ReactNode;
  sortable?: boolean;
}) {
  const [sortKey, setSortKey] = React.useState<
    | "rank"
    | "bc_rank"
    | "sleeper_rank_overall"
    | "fp_value"
    | null
  >(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const onHeaderClick = (
    key: "rank" | "bc_rank" | "sleeper_rank_overall" | "fp_value"
  ) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = React.useMemo(() => {
    if (!sortable || !sortKey) return rows;
    const arr = [...rows];
    const cmp = (a: PlayerRow, b: PlayerRow) => {
      const get = (r: PlayerRow): number => {
        switch (sortKey) {
          case "rank":
            return r.rank == null ? Number.POSITIVE_INFINITY : Number(r.rank);
          case "bc_rank":
            return r.bc_rank == null ? Number.POSITIVE_INFINITY : Number(r.bc_rank);
          case "sleeper_rank_overall":
            return r.sleeper_rank_overall == null
              ? Number.POSITIVE_INFINITY
              : Number(r.sleeper_rank_overall);
          case "fp_value":
            // sort descending by default for value (higher is better)
            return r.fp_value == null ? Number.NEGATIVE_INFINITY : Number(r.fp_value);
          default:
            return 0;
        }
      };
      const av = get(a);
      const bv = get(b);
      return av - bv;
    };
    arr.sort(cmp);
    if (sortDir === "desc") arr.reverse();
    return arr;
  }, [rows, sortable, sortKey, sortDir]);

  return (
    <Table>
      <TableHeader>
        {/* Group headers */}
        <TableRow>
          <TableHead colSpan={2} className="whitespace-nowrap">Player</TableHead>
          <TableHead colSpan={2} className="whitespace-nowrap">Boris Chen</TableHead>
          <TableHead colSpan={3} className="whitespace-nowrap">Sleeper</TableHead>
          <TableHead colSpan={8} className="whitespace-nowrap">FantasyPros</TableHead>
          {renderActions ? <TableHead /> : null}
        </TableRow>
        {/* Sub headers */}
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>TM/BW</TableHead>

          <TableHead
            onClick={() => onHeaderClick("bc_rank")}
            className={(sortable ? "cursor-pointer select-none " : "") + "whitespace-nowrap border-l border-y"}
          >
            RNK{sortable && sortKey === "bc_rank" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
          </TableHead>
          <TableHead className="whitespace-nowrap">RT</TableHead>

          <TableHead
            onClick={() => onHeaderClick("sleeper_rank_overall")}
            className={(sortable ? "cursor-pointer select-none " : "") + "whitespace-nowrap border-l border-y"}
          >
            RNK
            {sortable && sortKey === "sleeper_rank_overall"
              ? sortDir === "asc"
                ? " ▲"
                : " ▼"
              : ""}
          </TableHead>
          <TableHead className="whitespace-nowrap">ADP</TableHead>
          <TableHead className="whitespace-nowrap border-r border-y">PTS</TableHead>

          <TableHead className="whitespace-nowrap border-l border-y">RT</TableHead>
          <TableHead className="whitespace-nowrap">ECR</TableHead>
          <TableHead className="whitespace-nowrap">PRNK</TableHead>
          <TableHead className="whitespace-nowrap">PTS</TableHead>
          <TableHead
            onClick={() => onHeaderClick("fp_value")}
            className={(sortable ? "cursor-pointer select-none " : "") + "whitespace-nowrap"}
          >
            VAL
            {sortable && sortKey === "fp_value"
              ? sortDir === "asc"
                ? " ▲"
                : " ▼"
              : ""}
          </TableHead>
          <TableHead className="whitespace-nowrap">PS</TableHead>
          <TableHead className="whitespace-nowrap">%OWN</TableHead>
          <TableHead className="whitespace-nowrap border-r">MD</TableHead>

          {renderActions ? <TableHead className="w-10" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((p, idx) => (
          <TableRow key={`${p.player_id || p.name || "row"}-${idx}`}>
            <TableCell>{p.name}{p.position ? ` (${p.position})` : ""}</TableCell>
            <TableCell>
              {p.team || p.bye_week
                ? `${p.team ?? ""}${p.bye_week ? `/${p.bye_week}` : ""}`
                : "—"}
            </TableCell>

            <TableCell className="border-l border-y">{p.bc_rank ?? p.rank ?? "—"}</TableCell>
            <TableCell>{p.bc_tier ?? p.tier ?? "—"}</TableCell>

            <TableCell className="border-l border-y">{p.sleeper_rank_overall ?? "—"}</TableCell>
            <TableCell>{p.sleeper_adp ?? "—"}</TableCell>
            <TableCell className="border-r border-y">{p.sleeper_pts ?? "—"}</TableCell>

            <TableCell className="border-l border-y">{p.fp_tier ?? "—"}</TableCell>
            <TableCell>{p.fp_rank_overall ?? "—"}</TableCell>
            <TableCell>{p.fp_rank_pos ?? "—"}</TableCell>
            <TableCell>{p.fp_pts ?? "—"}</TableCell>
            <TableCell>{p.fp_value ?? "—"}</TableCell>
            <TableCell>
              {typeof p.fp_positional_scarcity_slope === "number"
                ? `${p.fp_positional_scarcity_slope}%`
                : "—"}
            </TableCell>
            <TableCell>
              {typeof p.fp_player_owned_avg === "number"
                ? `${Math.round(p.fp_player_owned_avg)}%`
                : "—"}
            </TableCell>
            <TableCell className={
              (typeof p.market_delta === "number"
                ? p.market_delta < 0
                  ? "text-green-600"
                  : p.market_delta > 0
                  ? "text-red-600"
                  : "text-foreground"
                : "text-foreground") + " border-r border-y"
            }>
              {p.market_delta ?? "—"}
            </TableCell>

            {renderActions ? <TableCell>{renderActions(p)}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

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
    return {
      player_id: pid,
      name,
      position: p.position ?? p.pos ?? nested.position ?? "—",
      rank: p.rank ?? nested.rank,
      tier: p.tier ?? nested.tier,
      team: p.team ?? p.pro_team ?? p.nfl_team ?? nested.team ?? "—",
      bye_week: p.bye_week ?? p.bye ?? nested.bye_week ?? "—",
      ecr_round_pick: extras.ecr_round_pick,
      val: extras.val,
      ps: extras.ps,
    };
  });
}
