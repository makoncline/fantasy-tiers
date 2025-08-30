import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCombinedAggregate, useDraftPicks, useSleeperPlayersMetaStatic } from "../_lib/useDraftQueries";
import { useSearchParams } from "next/navigation";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import enrichPlayers from "@/lib/enrichPlayers";
import { normalizePlayerName, ecrToRoundPick } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";
import { PlayerTable, mapToPlayerRow, type PlayerRow } from "./PlayerTable";
import PreviewPickDialog from "./PreviewPickDialog";

// Compact position tables: fixed columns and non-sortable, grouped by Boris Chen tiers
export default function PositionCompactTables() {
  const { league, beerSheetsBoard, availablePlayers, userRosterSlots } = useDraftData() as any;
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") || "";
  const { data: picks } = useDraftPicks(draftId);
  const { data: sleeperMeta } = useSleeperPlayersMetaStatic(Boolean(draftId));
  const DEFAULT_POS_TABLE_LIMIT = 10;
  const DEFAULT_ALL_TABLE_LIMIT = 20;
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggleExpanded = (key: string) =>
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  const [openLabel, setOpenLabel] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<any | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [showDrafted, setShowDrafted] = React.useState(false);

  const onPreview = React.useCallback((row: PlayerRow) => {
    const found = (availablePlayers as any[]).find((p: any) => p.player_id === row.player_id) ||
      (availablePlayers as any[]).find((p: any) => normalizePlayerName(p.name || p.full_name || "") === normalizePlayerName(row.name));
    if (found) {
      setPreviewPlayer(found);
      setPreviewOpen(true);
    }
  }, [availablePlayers]);

  // Extras from BeerSheets for VAL/PS if available (per-week VAL shown in PlayerTable usage)
  const extras = React.useMemo(() => {
    const map: Record<
      string,
      { val?: number; ps?: number; ecr_round_pick?: string }
    > = {};
    (beerSheetsBoard || []).forEach((r: any) => {
      const value = {
        val: Number.isFinite(r.val)
          ? Number((r.val / SEASON_WEEKS).toFixed(1))
          : r.val,
        ps: Number.isFinite(r.ps) ? Number(Math.round(r.ps)) : r.ps,
      } as const;
      map[r.player_id] = value;
      const nm = normalizePlayerName(r.name || "");
      if (nm) map[nm] = value;
    });
    return map;
  }, [beerSheetsBoard]);

  const qbAgg = useCombinedAggregate("QB", true).data;
  const rbAgg = useCombinedAggregate("RB", true).data;
  const wrAgg = useCombinedAggregate("WR", true).data;
  const teAgg = useCombinedAggregate("TE", true).data;
  const flexAgg = useCombinedAggregate("FLEX", true).data;
  const allAgg = useCombinedAggregate("ALL", true).data;
  const defAgg = useCombinedAggregate("DEF", true).data;
  const kAgg = useCombinedAggregate("K", true).data;

  const process = React.useCallback(
    (
      dataset: any | null | undefined,
      pos: "QB" | "RB" | "WR" | "TE" | "FLEX" | "DEF" | "K" | "ALL"
    ): PlayerRow[] => {
      if (!dataset || !league?.scoring) return [] as PlayerRow[];
      try {
        const enriched = enrichPlayers(Object.values(dataset), {
          teams: league.teams,
          scoring: league.scoring,
          roster: league.roster,
        } as any);
        const byId = new Map<string, any>();
        const byName = new Map<string, any>();
        for (const p of enriched) {
          const pid = String(p?.player_id || "");
          if (pid) byId.set(pid, p);
          const nm = normalizePlayerName(String(p?.name || ""));
          if (nm) byName.set(nm, p);
        }
        // Build base rows from the enriched shard itself so we don't drop
        // players that aren't currently in availablePlayers (e.g., K/DEF).
        const base = mapToPlayerRow(enriched as any[], extras);
        const merged = base.map((r) => {
          const hit =
            byId.get(r.player_id) || byName.get(normalizePlayerName(r.name));
          if (!hit) return r;
          return {
            ...r,
            bc_rank: hit.bc_rank ?? r.rank ?? undefined,
            bc_tier: hit.bc_tier ?? r.tier ?? undefined,
            sleeper_pts: hit.sleeper_pts ?? undefined,
            sleeper_adp: hit.sleeper_adp ?? undefined,
            sleeper_rank_overall: hit.sleeper_rank_overall ?? undefined,
            fp_pts: hit.fp_pts ?? undefined,
            ecr_round_pick:
              hit.fp_rank_overall != null && league?.teams
                ? ecrToRoundPick(
                    Number(hit.fp_rank_overall),
                    Number(league.teams)
                  )
                : undefined,
            fp_rank_overall: hit.fp_rank_overall ?? undefined,
            fp_rank_pos: hit.fp_rank_pos ?? undefined,
            fp_tier: hit.fp_tier ?? undefined,
            fp_baseline_pts: hit.fp_baseline_pts ?? undefined,
            fp_value: hit.fp_value ?? undefined,
            fp_positional_scarcity_slope:
              hit.fp_positional_scarcity_slope ?? undefined,
            fp_player_owned_avg: hit.fp_player_owned_avg ?? undefined,
            market_delta: hit.market_delta ?? undefined,
          } as PlayerRow;
        });
        return merged.sort(
          (a, b) =>
            (Number(a.bc_rank ?? 1e9) as number) -
            (Number(b.bc_rank ?? 1e9) as number)
        );
      } catch {
        return [] as PlayerRow[];
      }
    },
    [league, extras, availablePlayers]
  );

  const rowsQB = React.useMemo(() => process(qbAgg, "QB"), [process, qbAgg]);
  const rowsRB = React.useMemo(() => process(rbAgg, "RB"), [process, rbAgg]);
  const rowsWR = React.useMemo(() => process(wrAgg, "WR"), [process, wrAgg]);
  const rowsTE = React.useMemo(() => process(teAgg, "TE"), [process, teAgg]);
  const rowsFLEX = React.useMemo(
    () => process(flexAgg, "FLEX"),
    [process, flexAgg]
  );
  const rowsALL = React.useMemo(
    () => process(allAgg, "ALL"),
    [process, allAgg]
  );
  const rowsDEF = React.useMemo(() => process(defAgg, "DEF"), [process, defAgg]);
  const rowsK = React.useMemo(() => process(kAgg, "K"), [process, kAgg]);

  const sections: [string, PlayerRow[], "full" | "nameOnly"][] = [
    ["QB", rowsQB, "full"],
    ["RB", rowsRB, "full"],
    ["WR", rowsWR, "full"],
    ["FLEX", rowsFLEX, "full"],
    ["TE", rowsTE, "full"],
    ["DEF", rowsDEF, "full"],
    ["K", rowsK, "full"],
    ["ALL", rowsALL, "full"],
  ];

  // sticky nav + filter controls
  const labels = sections.map(([l]) => l);
  const draftedIds = React.useMemo(
    () => new Set((picks || []).map((p: any) => String(p.player_id))),
    [picks]
  );
  // Build drafted names directly from Sleeper players meta for reliable ID->name mapping
  const draftedNames = React.useMemo(() => {
    const set = new Set<string>();
    if (!picks || !sleeperMeta) return set;
    for (const p of picks) {
      const meta = (sleeperMeta as any)[String(p.player_id)];
      const full = String(meta?.full_name || meta?.name || "");
      const nm = normalizePlayerName(full);
      if (nm) set.add(nm);
    }
    return set;
  }, [picks, sleeperMeta]);
  const refs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const setRef = (label: string) => (el: HTMLDivElement | null) => {
    refs.current[label] = el;
  };
  const scrollTo = (label: string) => refs.current[label]?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={showAll} onCheckedChange={setShowAll} id="show-all" />
              <label htmlFor="show-all" className="text-xs text-muted-foreground select-none">Show all</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showDrafted} onCheckedChange={setShowDrafted} id="show-drafted" />
              <label htmlFor="show-drafted" className="text-xs text-muted-foreground select-none">Show drafted players</label>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {labels.map((l) => (
              <Button key={l} size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => scrollTo(l)}>
                {l}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-1">
      {sections.map(([label, rows, mode]) => {
        const isOpen = !!expanded[label];
        const limit =
          label === "ALL" ? DEFAULT_ALL_TABLE_LIMIT : DEFAULT_POS_TABLE_LIMIT;
        const allRows = showDrafted
          ? rows
          : rows.filter((r) => {
              const id = String(r.player_id);
              if (draftedIds.has(id)) return false;
              const nm = normalizePlayerName(r.name);
              if (nm && draftedNames.has(nm)) return false;
              return true;
            });
        const visible = showAll ? allRows : allRows.slice(0, limit);
        if (label === "RB") {
          try {
            console.log("[Compact RB]", {
              totalRows: rows.length,
              visibleCount: visible.length,
              draftedIdsSize: draftedIds.size,
              sample: visible.slice(0, 6).map((r) => ({
                id: r.player_id,
                name: r.name,
                draftedById: draftedIds.has(String(r.player_id)),
                draftedByName: draftedNames.has(normalizePlayerName(r.name)),
              })),
            });
          } catch {}
        }
        const baseline = React.useMemo(() => {
          const v = rows.find(
            (r) => typeof (r as any).fp_baseline_pts === "number"
          ) as any;
          return v?.fp_baseline_pts as number | undefined;
        }, [rows]);
        return (
          <div key={label} ref={setRef(label)} className="scroll-mt-24">
            <Card className="block w-full">
              <CardHeader className="py-1 px-2">
                <CardTitle className="text-sm flex items-baseline gap-2">
                  {label}
                  {typeof baseline === "number" ? (
                    <span className="text-xs text-muted-foreground font-normal">
                      baseline {baseline.toFixed(1)} pts
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-2 pb-2">
                <div className="overflow-x-auto">
                  <CompactTable rows={visible} mode={mode} draftedIds={draftedIds} draftedNames={draftedNames} renderActions={(r) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onPreview(r)}
                      aria-label="Preview"
                      title="Preview"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </Button>
                  )} />
                </div>
                {!showAll && rows.length > limit ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="w-full text-sm underline-offset-2 hover:underline"
                      onClick={() => setOpenLabel(label)}
                    >
                      Show More
                    </button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        );
      })}
      </div>
      <Dialog open={openLabel != null} onOpenChange={(o) => !o && setOpenLabel(null)}>
        <DialogContent className="max-w-6xl w-[92vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-baseline gap-2">
              {openLabel}
              {(() => {
                const tuple = sections.find(([lab]) => lab === openLabel);
                const set = tuple ? tuple[1] : [];
                const v = set.find((r) => typeof (r as any).fp_baseline_pts === "number") as any;
                const bl = v?.fp_baseline_pts as number | undefined;
                return typeof bl === "number" ? (
                  <span className="text-sm text-muted-foreground font-normal">baseline {bl.toFixed(1)} pts</span>
                ) : null;
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto pr-2">
            {(() => {
              const tuple = sections.find(([lab]) => lab === openLabel);
              if (!tuple) return null;
              const [, fullRows] = tuple;
              return (
                <PlayerTable
                  rows={showDrafted ? fullRows : fullRows.filter((r) => !draftedIds.has(String(r.player_id)))}
                  sortable
                  colorizeValuePs
                  draftedIds={draftedIds}
                  dimDrafted={showDrafted}
                  hideDrafted={!showDrafted}
                  renderActions={(r) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onPreview(r)}
                      aria-label="Preview"
                      title="Preview"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </Button>
                  )}
                />
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lineup preview modal */}
      <PreviewPickDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        baseSlots={userRosterSlots || []}
        player={previewPlayer}
      />
    </div>
  );
}

function CompactTable({
  rows,
  mode = "full",
  renderActions,
  draftedIds,
  draftedNames,
}: {
  rows: PlayerRow[];
  mode?: "full" | "nameOnly";
  renderActions?: (row: PlayerRow) => React.ReactNode;
  draftedIds?: Set<string>;
  draftedNames?: Set<string>;
}) {
  // Compute alternating backgrounds by Boris Chen tier
  let lastTier: number | string | null = null;
  let flip = false;

  // Helpers to colorize cells from green (high) to red (low)
  const vals = React.useMemo(() => {
    const list = rows
      .map((p) =>
        p.fp_value != null ? p.fp_value : p.val != null ? p.val : null
      )
      .filter((n): n is number => n != null);
    const min = list.length ? Math.min(...list) : 0;
    const max = list.length ? Math.max(...list) : 0;
    return { min, max };
  }, [rows]);
  const pss = React.useMemo(() => {
    const list = rows
      .map((p) =>
        typeof p.fp_positional_scarcity_slope === "number"
          ? p.fp_positional_scarcity_slope
          : typeof p.ps === "number"
          ? p.ps
          : null
      )
      .filter((n): n is number => n != null && n > 0);
    const min = list.length ? Math.min(...list) : 0;
    const max = list.length ? Math.max(...list) : 0;
    return { min, max };
  }, [rows]);

  function colorFor(value: number | null, min: number, max: number) {
    if (value == null || min === max) return undefined;
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    // 0 => red (0deg), 1 => green (120deg)
    const hue = Math.round(0 + (120 - 0) * t);
    return `hsl(${hue} 60% 30% / 0.35)`; // subtle overlay
  }

  return (
    <Table className="table-fixed w-full text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap w-[4ch] text-right">
            RNK
          </TableHead>
          <TableHead className="whitespace-nowrap w-[16ch]">Name</TableHead>
          {mode === "full" && (
            <>
              <TableHead className="whitespace-nowrap w-[7ch]">TM/BW</TableHead>
              <TableHead className="whitespace-nowrap w-[5ch]">ECR</TableHead>
              <TableHead className="whitespace-nowrap w-[3ch]">RT</TableHead>
              <TableHead className="whitespace-nowrap w-[5ch]">VAL</TableHead>
              <TableHead className="whitespace-nowrap w-[5ch]">PS</TableHead>
            </>
          )}
          {renderActions ? <TableHead className="w-8" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p, idx) => {
          const tier = p.bc_tier ?? p.tier ?? null;
          if (tier !== lastTier) {
            flip = !flip;
            lastTier = tier;
          }
          const band = flip ? "bg-muted/100" : "bg-muted/5";
          const isDrafted = Boolean(
            (draftedIds && draftedIds.has(String(p.player_id))) ||
              (draftedNames && draftedNames.has(normalizePlayerName(p.name)))
          );
          return (
            <TableRow
              key={`${p.player_id || p.name || "row"}-${idx}`}
              className={(isDrafted
                ? "opacity-60 text-muted-foreground hover:opacity-95 hover:text-foreground "
                : "") + band}
            >
              <TableCell className="whitespace-nowrap pr-2 text-right">
                {p.bc_rank ?? p.rank ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap max-w-[16ch] truncate">
                {p.name}
              </TableCell>
              {mode === "full" && (
                <>
                  <TableCell className="whitespace-nowrap">
                    {p.team || p.bye_week
                      ? `${p.team ?? ""}${p.bye_week ? `/${p.bye_week}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.ecr_round_pick ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.fp_tier ?? "—"}
                  </TableCell>
                  {(() => {
                    const v =
                      p.fp_value != null
                        ? p.fp_value
                        : p.val != null
                        ? p.val
                        : null;
                    const bg = colorFor(
                      typeof v === "number" ? v : null,
                      vals.min,
                      vals.max
                    );
                    return (
                      <TableCell
                        className="whitespace-nowrap"
                        style={bg ? { background: bg } : undefined}
                      >
                        {v != null ? v : "—"}
                      </TableCell>
                    );
                  })()}
                  {(() => {
                    const raw =
                      typeof p.fp_positional_scarcity_slope === "number"
                        ? p.fp_positional_scarcity_slope
                        : typeof p.ps === "number"
                        ? p.ps
                        : null;
                    const val = raw != null && raw > 0 ? Math.round(raw) : 0;
                    const bg =
                      val > 0 ? colorFor(val, pss.min, pss.max) : undefined;
                    return (
                      <TableCell
                        className="whitespace-nowrap"
                        style={bg ? { background: bg } : undefined}
                      >
                        {val === 0 ? "-" : `${val}%`}
                      </TableCell>
                    );
                  })()}
                </>
              )}
              {renderActions ? <TableCell className="w-8">{renderActions(p)}</TableCell> : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
