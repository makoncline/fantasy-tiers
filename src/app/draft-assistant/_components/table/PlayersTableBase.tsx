import React from "react";
import {
  Table,
  TableHeader,
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
  rows: PlayerWithPick[];
  groups: ColumnGroup<PlayerWithPick>[];
  sortable?: boolean;
  colorize?: boolean;
  dimDrafted?: boolean;
  hideDrafted?: boolean;
  renderActions?: (row: PlayerWithPick) => React.ReactNode;
  tierRowColors?: boolean; // Enable alternating tier-based row backgrounds
};

export default function PlayersTableBase({
  rows,
  groups,
  sortable = false,
  colorize = false,
  dimDrafted = false,
  hideDrafted = false,
  renderActions = undefined,
  tierRowColors = false,
}: Props) {
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
    for (const r of baseRows) {
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
  }, [baseRows, groups]);

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
  const [sortId, setSortId] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

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
      if (asNum) return Number(av) - Number(bv);
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === "desc") arr.reverse();
    return arr;
  }, [baseRows, activeCol, sortDir, sortable]);

  const onHeadClick = (c: ColumnDef<PlayerWithPick>) => {
    if (!sortable || !c.sortable) return;
    if (sortId === c.id) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortId(c.id);
      setSortDir(c.defaultDir ?? "asc");
    }
  };

  return (
    <Table>
      <TableHeader className="sticky top-0 z-50">
        {/* group row */}
        <TableRow>
          {groups.map((g, i) => (
            <TableHead
              key={i}
              colSpan={g.children.length}
              className="whitespace-nowrap"
            >
              {g.header}
            </TableHead>
          ))}
          {renderActions ? <TableHead /> : null}
        </TableRow>
        {/* header row */}
        <TableRow>
          {allColumns.map((c) => (
            <TableHead
              key={c.id}
              style={c.width ? { width: c.width } : undefined}
              onClick={() => onHeadClick(c)}
              className={
                (c.sortable ? "cursor-pointer select-none " : "") +
                (c.className ?? "")
              }
              title={c.header}
              aria-sort={
                sortable && c.sortable && sortId === c.id
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {c.header}
              {sortable && c.sortable && sortId === c.id
                ? sortDir === "asc"
                  ? " ▲"
                  : " ▼"
                : ""}
            </TableHead>
          ))}
          {renderActions ? <TableHead className="w-8" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, idx) => {
          const isDrafted = isDraftedRow(r);

          // Tier-based row coloring for compact tables
          let tierClass = "";
          if (tierRowColors) {
            const currentTier = r.bc_tier ?? r.tier ?? 1;
            // Even tiers get lighter background
            if (currentTier % 2 === 0) {
              tierClass = "bg-muted";
            }
          }

          const baseClass =
            dimDrafted && isDrafted
              ? "opacity-60 text-muted-foreground hover:opacity-95 hover:text-foreground"
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
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
