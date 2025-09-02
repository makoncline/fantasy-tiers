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
import type { PlayerRow } from "@/lib/playerRows";

export function PlayerTable({
  rows,
  renderActions,
  sortable = false,
  colorizeValuePs = false,
  draftedIds,
  hideDrafted = false,
  dimDrafted = false,
}: {
  rows: PlayerRow[];
  renderActions?: (row: PlayerRow) => React.ReactNode;
  sortable?: boolean;
  colorizeValuePs?: boolean;
  draftedIds?: Set<string>;
  hideDrafted?: boolean;
  dimDrafted?: boolean;
}) {
  const [sortKey, setSortKey] = React.useState<
    | "rank"
    | "bc_rank"
    | "sleeper_rank_overall"
    | "sleeper_adp"
    | "sleeper_pts"
    | "fp_rank_overall"
    | "fp_rank_pos"
    | "fp_pts"
    | "fp_value"
    | "fp_positional_scarcity_slope"
    | "fp_player_owned_avg"
    | "market_delta"
    | null
  >(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const onHeaderClick = (
    key:
      | "rank"
      | "bc_rank"
      | "sleeper_rank_overall"
      | "sleeper_adp"
      | "sleeper_pts"
      | "fp_rank_overall"
      | "fp_rank_pos"
      | "fp_pts"
      | "fp_value"
      | "fp_positional_scarcity_slope"
      | "fp_player_owned_avg"
      | "market_delta"
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
    const base =
      hideDrafted && draftedIds
        ? rows.filter((r) => !draftedIds.has(String(r.player_id)))
        : rows;
    if (!sortable || !sortKey) return base;
    const arr = [...base];
    const cmp = (a: PlayerRow, b: PlayerRow) => {
      const get = (r: PlayerRow): number => {
        switch (sortKey) {
          case "rank":
            return r.rank == null ? Number.POSITIVE_INFINITY : Number(r.rank);
          case "bc_rank":
            return r.bc_rank == null
              ? Number.POSITIVE_INFINITY
              : Number(r.bc_rank);
          case "sleeper_rank_overall":
            return r.sleeper_rank_overall == null
              ? Number.POSITIVE_INFINITY
              : Number(r.sleeper_rank_overall);
          case "sleeper_adp":
            return r.sleeper_adp == null
              ? Number.POSITIVE_INFINITY
              : Number(r.sleeper_adp);
          case "sleeper_pts":
            return r.sleeper_pts == null
              ? Number.POSITIVE_INFINITY
              : Number(r.sleeper_pts);
          case "fp_rank_overall":
            return r.fp_rank_overall == null
              ? Number.POSITIVE_INFINITY
              : Number(r.fp_rank_overall);
          case "fp_rank_pos":
            return r.fp_rank_pos == null
              ? Number.POSITIVE_INFINITY
              : Number(r.fp_rank_pos);
          case "fp_pts":
            return r.fp_pts == null
              ? Number.POSITIVE_INFINITY
              : Number(r.fp_pts);
          case "fp_value":
            // sort descending by default for value (higher is better)
            return r.fp_value == null
              ? Number.NEGATIVE_INFINITY
              : Number(r.fp_value);
          case "fp_positional_scarcity_slope":
            return r.fp_positional_scarcity_slope == null
              ? Number.NEGATIVE_INFINITY
              : Number(r.fp_positional_scarcity_slope);
          case "fp_player_owned_avg":
            return r.fp_player_owned_avg == null
              ? Number.NEGATIVE_INFINITY
              : Number(r.fp_player_owned_avg);
          case "market_delta":
            return r.market_delta == null
              ? Number.NEGATIVE_INFINITY
              : Number(r.market_delta);
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
  }, [rows, sortable, sortKey, sortDir, hideDrafted, draftedIds]);

  // Color ranges for VAL / PS if requested
  const valRange = React.useMemo(() => {
    if (!colorizeValuePs) return null;
    const nums = rows
      .map((r) =>
        r.fp_value != null ? r.fp_value : r.val != null ? r.val : null
      )
      .filter((n): n is number => n != null);
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;
    return { min, max };
  }, [rows, colorizeValuePs]);
  const psRange = React.useMemo(() => {
    if (!colorizeValuePs) return null;
    const nums = rows
      .map((r) =>
        typeof r.fp_positional_scarcity_slope === "number"
          ? r.fp_positional_scarcity_slope
          : typeof r.ps === "number"
          ? r.ps
          : null
      )
      .filter((n): n is number => n != null && n > 0);
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;
    return { min, max };
  }, [rows, colorizeValuePs]);
  const mdRange = React.useMemo(() => {
    if (!colorizeValuePs) return null;
    const nums = rows
      .map((r) => (typeof r.market_delta === "number" ? r.market_delta : null))
      .filter((n): n is number => n != null);
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;
    return { min, max };
  }, [rows, colorizeValuePs]);
  const colorFor = React.useCallback(
    (value: number | null, range: { min: number; max: number } | null) => {
      if (!range || value == null || range.min === range.max) return undefined;
      const t = Math.max(
        0,
        Math.min(1, (value - range.min) / (range.max - range.min))
      );
      const hue = Math.round(120 * t); // 0=red -> 120=green
      return `hsl(${hue} 60% 30% / 0.35)`;
    },
    []
  );

  const headerMarkup = (
    <TableHeader className="sticky top-0 z-50">
      {/* Group headers */}
      <TableRow>
        <TableHead colSpan={2} className="whitespace-nowrap">
          Player
        </TableHead>
        <TableHead colSpan={2} className="whitespace-nowrap">
          Boris Chen
        </TableHead>
        <TableHead colSpan={3} className="whitespace-nowrap">
          Sleeper
        </TableHead>
        <TableHead colSpan={5} className="whitespace-nowrap">
          FantasyPros
        </TableHead>
        <TableHead colSpan={3} className="whitespace-nowrap">
          Calc
        </TableHead>
        {renderActions ? <TableHead /> : null}
      </TableRow>
      {/* Sub headers */}
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>TM/BW</TableHead>
        <TableHead
          onClick={() => onHeaderClick("bc_rank")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap border-l border-y"
          }
        >
          RNK
          {sortable && sortKey === "bc_rank"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead className="whitespace-nowrap">RT</TableHead>

        <TableHead
          onClick={() => onHeaderClick("sleeper_rank_overall")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap border-l border-y"
          }
        >
          RNK
          {sortable && sortKey === "sleeper_rank_overall"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("sleeper_adp")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap"
          }
        >
          ADP
          {sortable && sortKey === "sleeper_adp"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("sleeper_pts")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap border-r border-y"
          }
        >
          PTS
          {sortable && sortKey === "sleeper_pts"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>

        <TableHead className="whitespace-nowrap border-l border-y">
          RT
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("fp_rank_overall")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap"
          }
        >
          ECR
          {sortable && sortKey === "fp_rank_overall"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("fp_rank_pos")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap"
          }
        >
          PRNK
          {sortable && sortKey === "fp_rank_pos"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("fp_pts")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap"
          }
        >
          PTS
          {sortable && sortKey === "fp_pts"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("fp_player_owned_avg")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap"
          }
        >
          %OWN
          {sortable && sortKey === "fp_player_owned_avg"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("fp_value")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap border-l border-y"
          }
        >
          VAL
          {sortable && sortKey === "fp_value"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("fp_positional_scarcity_slope")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap"
          }
        >
          PS
          {sortable && sortKey === "fp_positional_scarcity_slope"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>
        <TableHead
          onClick={() => onHeaderClick("market_delta")}
          className={
            (sortable ? "cursor-pointer select-none " : "") +
            "whitespace-nowrap border-r border-y"
          }
        >
          MD
          {sortable && sortKey === "market_delta"
            ? sortDir === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </TableHead>

        {renderActions ? <TableHead className="w-8 text-xs" /> : null}
      </TableRow>
    </TableHeader>
  );

  const bodyMarkup = (
    <TableBody>
      {sortedRows.map((p, idx) => (
        <TableRow
          key={`${p.player_id || p.name || "row"}-${idx}`}
          className={
            dimDrafted && draftedIds && draftedIds.has(String(p.player_id))
              ? "opacity-60 text-muted-foreground hover:opacity-95 hover:text-foreground"
              : undefined
          }
        >
          <TableCell>
            <span
              data-drafted={
                draftedIds && draftedIds.has(String(p.player_id)) ? "D" : ""
              }
            >
              {p.name}
              {p.position ? ` (${p.position})` : ""}
            </span>
          </TableCell>
          <TableCell>
            {p.team || p.bye_week
              ? `${p.team ?? ""}${p.bye_week ? `/${p.bye_week}` : ""}`
              : "—"}
          </TableCell>

          <TableCell className="border-l border-y">
            {p.bc_rank ?? p.rank ?? "—"}
          </TableCell>
          <TableCell>{p.bc_tier ?? p.tier ?? "—"}</TableCell>

          <TableCell className="border-l border-y">
            {p.sleeper_rank_overall ?? "—"}
          </TableCell>
          <TableCell>{p.sleeper_adp ?? "—"}</TableCell>
          <TableCell className="border-r border-y">
            {p.sleeper_pts ?? "—"}
          </TableCell>

          <TableCell className="border-l border-y">
            {p.fp_tier ?? "—"}
          </TableCell>
          <TableCell>{p.ecr_round_pick ?? "—"}</TableCell>
          <TableCell>
            {typeof p.fp_rank_pos === "number" && p.position
              ? `${String(p.position).toUpperCase()}${p.fp_rank_pos}`
              : "—"}
          </TableCell>
          <TableCell>{p.fp_pts ?? "—"}</TableCell>
          <TableCell>
            {typeof p.fp_player_owned_avg === "number"
              ? `${Math.round(p.fp_player_owned_avg)}%`
              : "—"}
          </TableCell>
          <TableCell
            className="border-l border-y"
            style={{
              background: colorizeValuePs
                ? colorFor(p.fp_value ?? p.val ?? null, valRange)
                : undefined,
            }}
          >
            {p.fp_value ?? p.val ?? "—"}
          </TableCell>
          <TableCell
            style={{
              background:
                colorizeValuePs &&
                typeof (p.fp_positional_scarcity_slope ?? p.ps) === "number" &&
                (p.fp_positional_scarcity_slope ?? p.ps) != null &&
                (p.fp_positional_scarcity_slope ?? p.ps)! > 0
                  ? colorFor(
                      p.fp_positional_scarcity_slope ?? (p.ps as number),
                      psRange
                    )
                  : undefined,
            }}
          >
            {typeof p.fp_positional_scarcity_slope === "number"
              ? p.fp_positional_scarcity_slope > 0
                ? `${Math.round(p.fp_positional_scarcity_slope)}%`
                : "-"
              : typeof p.ps === "number"
              ? p.ps > 0
                ? `${Math.round(p.ps)}%`
                : "-"
              : "—"}
          </TableCell>
          <TableCell
            className="border-r border-y"
            style={{
              background: colorizeValuePs
                ? colorFor(
                    typeof p.market_delta === "number" ? p.market_delta : null,
                    mdRange
                  )
                : undefined,
            }}
          >
            {p.market_delta ?? "—"}
          </TableCell>

          {renderActions ? (
            <TableCell className="w-8 text-xs p-0">
              {renderActions(p)}
            </TableCell>
          ) : null}
        </TableRow>
      ))}
    </TableBody>
  );

  return (
    <Table>
      {headerMarkup}
      {bodyMarkup}
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
