import { WatchlistButton, useDraftWatchlist } from "../DraftWatchlistContext";
import { useDraftPreference, draftSortIdPreference, draftSortDirectionPreference } from "@/hooks/useDraftPreference";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableCaption,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { isDraftedRow } from "@/lib/drafted";
import { fmt } from "@/lib/formatters";
import type { PlayerWithPick } from "@/lib/types.draft";
import type { ColumnGroup, ColumnDef, HeatScaleId } from "./columns";

type Props = {
  preferenceKey?: string | undefined;
  rows: PlayerWithPick[];
  groups: ColumnGroup<PlayerWithPick>[];
  sortable?: boolean;
  colorize?: boolean;
  dimDrafted?: boolean;
  hideDrafted?: boolean;
  renderActions?: ((row: PlayerWithPick) => React.ReactNode) | undefined;
  maxRows?: number | undefined;
  defaultSortId?: string | undefined;
  defaultSortDir?: "asc" | "desc" | undefined;
  heatDomainRows?: PlayerWithPick[] | undefined;
};

export default function PlayersTableBase({
  rows,
  preferenceKey,
  groups,
  sortable = false,
  colorize = false,
  dimDrafted = false,
  hideDrafted = false,
  renderActions = undefined,
  maxRows,
  defaultSortId,
  defaultSortDir = "asc",
  heatDomainRows,
}: Props) {
  const watchlist = useDraftWatchlist();
  // 1) Filter/dim drafted once
  const baseRows = React.useMemo(
    () => (hideDrafted ? rows.filter((r) => !isDraftedRow(r)) : rows),
    [rows, hideDrafted]
  );

  // 2) Heat scales computed from visible rows across all columns that declare heat
  const scales = React.useMemo(() => {
    const ids: HeatScaleId[] = ["val", "ps", "md"];
    const init = Object.fromEntries(
      ids.map((k) => [k, { min: +Infinity, max: -Infinity }])
    ) as Record<HeatScaleId, { min: number; max: number }>;
    for (const r of heatDomainRows ?? baseRows) {
      for (const g of groups)
        for (const c of g.children) {
          if (!c.heat) continue;
          const v = c.accessor(r);
          if (typeof v === "number" && Number.isFinite(v)) {
            const s = init[c.heat.scale];
            if (v < s.min) s.min = v;
            if (v > s.max) s.max = v;
          }
        }
    }
    return init;
  }, [baseRows, groups, heatDomainRows]);

  const heatBg = (
    scale: HeatScaleId | undefined,
    v: number | string | null | undefined
  ) => {
    if (!colorize || !scale || typeof v !== "number" || !Number.isFinite(v))
      return undefined;
    const { min, max } = scales[scale];
    if (!(max > min)) return undefined;
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    const hue = Math.round(120 * t); // red->green
    return `hsl(${hue} 60% 30% / 0.35)`;
  };

  // 3) Sorting driven by column ids
  const sortPreferenceKey = `table:${preferenceKey ?? groups[0]?.children[0]?.header ?? "players"}`;
  const [sortId, setSortId] = useDraftPreference<string | null>(`${sortPreferenceKey}:sort`, draftSortIdPreference,
    dimDrafted && defaultSortId === "adj" ? "raw" : defaultSortId ?? null
  );
  const [sortDir, setSortDir] = useDraftPreference(`${sortPreferenceKey}:direction`, draftSortDirectionPreference, defaultSortDir);
  const [previousDimDrafted, setPreviousDimDrafted] = React.useState(dimDrafted);
  // Drafted players have no current recommendation score. On reveal, use
  // comparable base values instead of pushing those rows below the visible slice.
  if (previousDimDrafted !== dimDrafted) {
    setPreviousDimDrafted(dimDrafted);
    if (dimDrafted && sortId === "adj") {
      setSortId("raw");
      setSortDir("desc");
    }
  }


  const allColumns: ColumnDef<PlayerWithPick>[] = groups.flatMap(
    (g) => g.children
  );
  const activeCol = React.useMemo(
    () => allColumns.find((c) => c.id === sortId) ?? null,
    [allColumns, sortId]
  );

  const sorted = React.useMemo(() => {
    if (!sortable || !activeCol) return baseRows;
    const arr = [...baseRows];
    arr.sort((a, b) => {
      const av = activeCol.accessor(a);
      const bv = activeCol.accessor(b);
      const asNum = activeCol.sortAs !== "string";
      const nullWeight = activeCol.nulls === "first" ? -1 : 1;
      const aNull =
        av == null ||
        (asNum && (typeof av !== "number" || !Number.isFinite(av)));
      const bNull =
        bv == null ||
        (asNum && (typeof bv !== "number" || !Number.isFinite(bv)));
      if (aNull && bNull) return 0;
      if (aNull) return nullWeight;
      if (bNull) return -nullWeight;
      const comparison = asNum
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv));
      return sortDir === "desc" ? -comparison : comparison;
    });
    return arr;
  }, [baseRows, activeCol, sortDir, sortable]);

  const visibleRows = React.useMemo(
    () => {
      if (maxRows == null) return sorted;
      let available = 0;
      const cutoff = sorted.findIndex(row => {
        if (isDraftedRow(row)) return false;
        available += 1;
        return available > maxRows;
      });
      return cutoff < 0 ? sorted : sorted.slice(0, cutoff);
    },
    [maxRows, sorted]
  );

  const tierBandClasses = React.useMemo(() => {
    if (!activeCol || (sortId !== "tier_level" && sortId !== "position_tier")) return [];

    let currentTier: number | string | null = null;
    let bandIndex = -1;
    return visibleRows.map((row) => {
      const nextTier = activeCol.accessor(row) ?? "unranked";
      if (nextTier !== currentTier) {
        currentTier = nextTier;
        bandIndex += 1;
      }
      return nextTier === "unranked" ? "" : bandIndex % 2 === 1 ? "bg-violet-500/10" : "bg-sky-500/10";
    });
  }, [sortId, activeCol, visibleRows]);

  const onHeadClick = (c: ColumnDef<PlayerWithPick>) => {
    if (!sortable || !c.sortable) return;
    if (sortId === c.id) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortId(c.id);
      setSortDir(c.defaultDir ?? "asc");
    }
  };

  return (
    <Table className="w-auto border border-border text-xs">
      {sortable ? <TableCaption className="sr-only">{visibleRows.length} of {baseRows.length} players</TableCaption> : null}
      <TableHeader className="sticky top-0 z-30 bg-muted">
        <TableRow>
          {allColumns.map((c) => (
            <TableHead
              key={c.id}
              style={c.width ? { width: c.width } : undefined}
              className={
                "h-8 whitespace-nowrap border-r border-border px-2 " + (c.sortable ? "cursor-pointer select-none " : "") +
                (c.sortAs === "number" ? "text-right " : "") + (c.className ?? "")
              }
              title={c.description ?? c.header}
              aria-sort={
                sortable && c.sortable && sortId === c.id
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
<Button variant="ghost" className="h-auto p-0 text-inherit" disabled={!sortable || !c.sortable} onClick={() => onHeadClick(c)}>{c.header}{sortable && c.sortable && sortId === c.id ? sortDir === "asc" ? " ▲" : " ▼" : ""}</Button>
            </TableHead>
          ))}
          {renderActions ? <TableHead className="w-8" /> : null}
          {watchlist ? <TableHead className="w-8"><span className="sr-only">Watch list</span></TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleRows.map((r, idx) => {
          const isDrafted = isDraftedRow(r);
          const tierClass = tierBandClasses[idx] ?? "";

          const baseClass =
            dimDrafted && isDrafted
              ? "bg-muted/40 text-muted-foreground"
              : undefined;

          const combinedClass =
            [baseClass, tierClass].filter(Boolean).join(" ") || undefined;

          return (
            <TableRow
              key={`${r.player_id || r.name || "row"}-${idx}`}
              data-row-drafted={isDrafted ? "true" : undefined}
              className={combinedClass}
            >
              {allColumns.map((c) => {
                const v = c.accessor(r);
                const content = c.render ? c.render(v, r) : fmt.empty(v);
                const bg = heatBg(c.heat?.scale, v);
                const isNameCol = c.id === "name";
                return (
                  <TableCell
                    key={c.id}
                    className={`border-r border-border px-2 py-1.5 tabular-nums ${c.sortAs === "number" ? "text-right" : ""}`}
                    {...(isNameCol && isDrafted ? { "data-drafted": "D" } : {})}
                    style={bg ? { background: bg } : undefined}
                  >
                    {content}
                  </TableCell>
                );
              })}
              {renderActions ? (
                <TableCell className="w-8 p-0">{renderActions(r)}</TableCell>
              ) : null}
              {watchlist ? <TableCell className="w-8 p-1"><WatchlistButton playerId={r.player_id} name={r.name} /></TableCell> : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
