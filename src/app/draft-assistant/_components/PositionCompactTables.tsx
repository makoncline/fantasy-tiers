import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAggregates,
  useAggregatesLastModified,
  useQBAggregates,
  useRBAggregates,
  useWRAggregates,
  useTEAggregates,
  useKAggregates,
  useDEFAggregates,
  useFlexAggregates,
  useShardAggregates,
  useDraftPicks,
  useSleeperPlayersMetaStatic,
} from "../_lib/useDraftQueries";
import { useDraftedLookups } from "../_lib/useDraftedLookups";
import { useSearchParams } from "next/navigation";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { enrichPlayers } from "@/lib/enrichPlayers";
import { normalizePlayerName, ecrToRoundPick } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";
import { PlayerTable } from "./PlayerTable";
import type { PlayerRow, Extras } from "@/lib/playerRows";
import { toPlayerRows } from "@/lib/playerRows";
import type { CombinedEntryT } from "@/lib/schemas-aggregates";
import type { RankedPlayer } from "@/lib/schemas";
import type { League } from "@/lib/enrichPlayers";
import type { BeerRow } from "@/lib/beersheets";
import { sortByBcRank, findBaseline } from "@/lib/playerSorts";

import PreviewPickDialog from "./PreviewPickDialog";
import { normalizePosition } from "@/lib/util";
import { CheckIcon, EyeIcon } from "lucide-react";

// Compact position tables: fixed columns and non-sortable, grouped by Boris Chen tiers
interface PositionCompactTablesProps {
  showAll?: boolean;
  setShowAll?: (value: boolean) => void;
  showDrafted?: boolean;
  setShowDrafted?: (value: boolean) => void;
  showUnranked?: boolean;
  setShowUnranked?: (value: boolean) => void;
}

export default function PositionCompactTables({
  showAll: externalShowAll,
  setShowAll: externalSetShowAll,
  showDrafted: externalShowDrafted,
  setShowDrafted: externalSetShowDrafted,
  showUnranked: externalShowUnranked,
  setShowUnranked: externalSetShowUnranked,
}: PositionCompactTablesProps = {}) {
  const {
    league,
    beerSheetsBoard,
    availablePlayers,
    userRosterSlots,
    userPositionCounts,
    userPositionNeeds,
  } = useDraftData();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") || "";
  const { data: picks } = useDraftPicks(draftId);
  const { data: sleeperMeta } = useSleeperPlayersMetaStatic(Boolean(draftId));
  const { data: lastModified } = useAggregatesLastModified();

  // Use individual position data from their respective files
  const { data: qbData } = useQBAggregates();
  const { data: rbData } = useRBAggregates();
  const { data: wrData } = useWRAggregates();
  const { data: teData } = useTEAggregates();
  const { data: kData } = useKAggregates();
  const { data: defData } = useDEFAggregates();
  const { data: flexData } = useFlexAggregates();

  // Get ALL data for the all players table using the ALL shard
  const { data: allAggregates } = useShardAggregates("ALL");
  const DEFAULT_POS_TABLE_LIMIT = 10;
  const DEFAULT_ALL_TABLE_LIMIT = 20;
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggleExpanded = (key: string) =>
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  const [openLabel, setOpenLabel] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );

  // Use external state if provided, otherwise use local state
  const [localShowAll, setLocalShowAll] = React.useState(false);
  const [localShowDrafted, setLocalShowDrafted] = React.useState(false);
  const [localShowUnranked, setLocalShowUnranked] = React.useState(false);

  const showAll = externalShowAll ?? localShowAll;
  const setShowAll = externalSetShowAll ?? setLocalShowAll;
  const showDrafted = externalShowDrafted ?? localShowDrafted;
  const setShowDrafted = externalSetShowDrafted ?? setLocalShowDrafted;
  const showUnranked = externalShowUnranked ?? localShowUnranked;
  const setShowUnranked = externalSetShowUnranked ?? setLocalShowUnranked;

  // Dialog-scoped toggles (default from page state when opened)
  const [dlgShowDrafted, setDlgShowDrafted] = React.useState(false);
  const [dlgShowUnranked, setDlgShowUnranked] = React.useState(false);
  React.useEffect(() => {
    if (openLabel != null) {
      setDlgShowDrafted(showDrafted);
      setDlgShowUnranked(showUnranked);
    }
  }, [openLabel, showDrafted, showUnranked]);

  const onPreview = React.useCallback(
    (row: PlayerRow) => {
      // First try to find player in availablePlayers by ID
      let found = availablePlayers?.find(
        (p) => String(p.player_id) === String(row.player_id)
      );

      // If not found by ID, try by name
      if (!found) {
        found = availablePlayers?.find(
          (p) =>
            normalizePlayerName(p.name || "") === normalizePlayerName(row.name)
        );
      }

      if (found && userRosterSlots && userRosterSlots.length > 0) {
        // Convert found player to RankedPlayer format
        const rankedPlayer: RankedPlayer = {
          player_id: found.player_id,
          name: found.name,
          position: found.position,
          team: found.team,
          bye_week: found.bye_week,
          rank: found.rank || 0,
          tier: found.tier || 0,
        };
        setPreviewPlayer(rankedPlayer);
        setPreviewOpen(true);
      } else {
        // If we can't find the player, try to create a basic player object for preview
        if (userRosterSlots && userRosterSlots.length > 0) {
          const fallbackPlayer: RankedPlayer = {
            player_id: row.player_id,
            name: row.name,
            position: row.position,
            team: row.team,
            bye_week:
              typeof row.bye_week === "number"
                ? row.bye_week.toString()
                : row.bye_week,
            rank: row.rank || 0,
            tier: row.tier || 0,
          };
          setPreviewPlayer(fallbackPlayer);
          setPreviewOpen(true);
        }
      }
    },
    [availablePlayers, userRosterSlots]
  );

  // Extras from BeerSheets for VAL/PS if available (per-week VAL shown in PlayerTable usage)
  const extras = React.useMemo((): Extras => {
    const map: Extras = {};
    (beerSheetsBoard || []).forEach((r: BeerRow) => {
      const value: { val?: number; ps?: number } = {};
      if (r.val != null && Number.isFinite(r.val)) {
        value.val = Number((r.val / SEASON_WEEKS).toFixed(1));
      }
      if (r.ps != null && Number.isFinite(r.ps)) {
        value.ps = Number(Math.round(r.ps));
      }
      map[r.player_id] = value;
      const nm = normalizePlayerName(r.name || "");
      if (nm) map[nm] = value;
    });
    return map;
  }, [beerSheetsBoard]);

  const process = React.useCallback(
    (
      players: CombinedEntryT[],
      pos: "QB" | "RB" | "WR" | "TE" | "FLEX" | "DEF" | "K" | "ALL"
    ): PlayerRow[] => {
      if (!players || !league?.scoring) {
        return [];
      }
      try {
        const leagueForEnrich: League = {
          teams: league.teams,
          scoring: league.scoring,
          roster: league.roster,
        };
        const enriched = enrichPlayers(players, leagueForEnrich);
        // Use the new typed function to convert to PlayerRows
        const rows = toPlayerRows([...enriched], extras, league.teams);
        return sortByBcRank(rows);
      } catch (error) {
        console.error(`process error for ${pos}:`, error);
        return [];
      }
    },
    [league, extras]
  );

  // Each position now uses data from its own dedicated file

  /* eslint-disable react-hooks/exhaustive-deps */
  const rowsQB = React.useMemo(() => {
    return qbData ? process(qbData, "QB") : [];
  }, [process, qbData]);
  const rowsRB = React.useMemo(() => {
    return rbData ? process(rbData, "RB") : [];
  }, [process, rbData]);
  const rowsWR = React.useMemo(() => {
    return wrData ? process(wrData, "WR") : [];
  }, [process, wrData]);
  const rowsTE = React.useMemo(() => {
    return teData ? process(teData, "TE") : [];
  }, [process, teData]);
  const rowsK = React.useMemo(() => {
    return kData ? process(kData, "K") : [];
  }, [process, kData]);
  const rowsDEF = React.useMemo(() => {
    return defData ? process(defData, "DEF") : [];
  }, [process, defData]);
  const rowsFLEX = React.useMemo(() => {
    return flexData ? process(flexData, "FLEX") : [];
  }, [process, flexData]);
  const rowsALL = React.useMemo(() => {
    return allAggregates ? process(allAggregates, "ALL") : [];
  }, [process, allAggregates]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const sections: [string, PlayerRow[], "full" | "nameOnly"][] = [
    ["QB", rowsQB, "full"],
    ["RB", rowsRB, "full"],
    ["WR", rowsWR, "full"],
    ["FLEX", rowsFLEX, "full"],
    ["TE", rowsTE, "full"],
    ["DEF", rowsDEF, "full"],
    ["K", rowsK, "full"],
    // ["ALL", rowsALL, "full"],
  ];

  // sticky nav + filter controls
  const labels = sections.map(([l]) => l);
  const posFromLabel = (
    l: string
  ): "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | null => {
    switch (l) {
      case "QB":
      case "RB":
      case "WR":
      case "TE":
      case "K":
      case "DEF":
      case "FLEX":
        return l;
      default:
        return null;
    }
  };
  // Use centralized drafted lookups hook
  const { draftedIds, draftedNames } = useDraftedLookups(picks, sleeperMeta);
  const refs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const setRef = (label: string) => (el: HTMLDivElement | null) => {
    refs.current[label] = el;
  };
  const scrollTo = (label: string) =>
    refs.current[label]?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Dynamically position the toolbar below the sticky Draft Status card
  const [stickyTop, setStickyTop] = React.useState<number>(72);
  React.useEffect(() => {
    const card = document.getElementById("draft-status-card");
    if (!card) return;
    const measure = () => {
      try {
        const h = card.getBoundingClientRect().height;
        setStickyTop(Math.max(0, Math.round(h + 8))); // small gap
      } catch {}
    };
    measure();
    const hasRO = typeof window !== "undefined" && "ResizeObserver" in window;
    const ro = hasRO ? new ResizeObserver(() => measure()) : null;
    ro?.observe(card);
    window.addEventListener("resize", measure);
    const id = window.setInterval(measure, 1000);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.clearInterval(id);
    };
  }, []);

  // Show loading state if position data is not loaded

  if (
    !qbData &&
    !rbData &&
    !wrData &&
    !teData &&
    !kData &&
    !defData &&
    !flexData &&
    !allAggregates
  ) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground" aria-live="polite">
            Loading player data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="sticky z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ top: stickyTop }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-2 md:gap-4 px-1 py-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={showAll}
                onCheckedChange={setShowAll}
                id="show-all"
              />
              <label
                htmlFor="show-all"
                className="text-xs text-muted-foreground select-none"
              >
                Show all
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={showDrafted}
                onCheckedChange={setShowDrafted}
                id="show-drafted"
              />
              <label
                htmlFor="show-drafted"
                className="text-xs text-muted-foreground select-none"
              >
                Show drafted players
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={showUnranked}
                onCheckedChange={setShowUnranked}
                id="show-unranked"
              />
              <label
                htmlFor="show-unranked"
                className="text-xs text-muted-foreground select-none"
              >
                Show unranked players
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 w-full md:w-auto justify-start md:justify-end">
            {labels.map((l) => (
              <Button
                key={l}
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => scrollTo(l)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
        {/* Data timestamp */}
        <div className="text-xs text-muted-foreground text-right">
          Data last updated: {lastModified?.formatted || "Loading..."}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-1">
        {sections.map(([label, rows, mode]) => {
          const isOpen = !!expanded[label];
          const limit =
            label === "ALL" ? DEFAULT_ALL_TABLE_LIMIT : DEFAULT_POS_TABLE_LIMIT;
          // Optionally include only players that have a Boris Chen rank
          const eligible = showUnranked
            ? rows
            : rows.filter((r) => typeof r.bc_rank === "number");
          const allRows = showDrafted
            ? eligible
            : eligible.filter((r) => {
                const id = String(r.player_id);
                if (draftedIds.has(id)) return false;
                const nm = normalizePlayerName(r.name);
                if (nm && draftedNames.has(nm)) return false;
                return true;
              });
          const visible = showAll ? allRows : allRows.slice(0, limit);
          const baseline = findBaseline(rows);
          return (
            <div
              key={label}
              ref={setRef(label)}
              className="scroll-mt-24"
              style={{ scrollMarginTop: stickyTop + 16 }}
            >
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
                  {(() => {
                    const pos = posFromLabel(label);
                    if (!pos) return null;
                    const rosterCount = userPositionCounts?.[pos] ?? 0;
                    const rosterNeeds = userPositionNeeds?.[pos] ?? 0;
                    const rosterReq = rosterCount + rosterNeeds;
                    const met = rosterReq > 0 && rosterCount >= rosterReq;
                    return (
                      <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-0.5">
                        <div className="flex items-center gap-1">
                          <span>
                            roster {rosterCount}/{rosterReq}
                          </span>
                          {met ? (
                            <svg
                              aria-label="met"
                              className="h-3 w-3 text-green-500"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </CardHeader>
                <CardContent className="pt-0 px-2 pb-2">
                  <div className="overflow-x-auto">
                    <CompactTable
                      rows={visible}
                      mode={mode}
                      draftedIds={draftedIds}
                      draftedNames={draftedNames}
                      renderActions={(r) => (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onPreview(r)}
                          aria-label="Preview"
                          title="Preview"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </Button>
                      )}
                    />
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
      <Dialog
        open={openLabel != null}
        onOpenChange={(o) => !o && setOpenLabel(null)}
      >
        <DialogContent className="max-w-6xl w-[92vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-baseline gap-2">
              {openLabel}
              {(() => {
                const tuple = sections.find(([lab]) => lab === openLabel);
                const set = tuple ? tuple[1] : [];
                const bl = findBaseline(set);
                return typeof bl === "number" ? (
                  <span className="text-sm text-muted-foreground font-normal">
                    baseline {bl.toFixed(1)} pts
                  </span>
                ) : null;
              })()}
            </DialogTitle>
            {(() => {
              const pos = openLabel ? posFromLabel(openLabel) : null;
              if (!pos) return null;
              const rosterCount = userPositionCounts?.[pos] ?? 0;
              const rosterNeeds = userPositionNeeds?.[pos] ?? 0;
              const rosterReq = rosterCount + rosterNeeds;
              const met = rosterReq > 0 && rosterCount >= rosterReq;
              return (
                <div className="text-xs text-muted-foreground flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-1">
                    <span>
                      roster {rosterCount}/{rosterReq}
                    </span>
                    {met ? (
                      <CheckIcon className="h-3 w-3 text-green-500" />
                    ) : null}
                  </div>
                  {/* Dialog-scoped toggles */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={dlgShowDrafted}
                        onCheckedChange={setDlgShowDrafted}
                      />{" "}
                      <span>Show drafted</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={dlgShowUnranked}
                        onCheckedChange={setDlgShowUnranked}
                      />{" "}
                      <span>Show unranked</span>
                    </label>
                  </div>
                </div>
              );
            })()}
            <DialogDescription>
              Detailed view of {openLabel} players with rankings and statistics.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto pr-2">
            {(() => {
              const tuple = sections.find(([lab]) => lab === openLabel);
              if (!tuple) return null;
              const [, fullRowsRaw] = tuple;
              // Respect dialog toggles in the dialog view
              const dlgEligible = (fullRowsRaw || []).filter((r) =>
                dlgShowUnranked ? true : typeof r.bc_rank === "number"
              );
              const fullRows = dlgShowDrafted
                ? dlgEligible
                : dlgEligible.filter(
                    (r) => !draftedIds.has(String(r.player_id))
                  );
              return (
                <PlayerTable
                  rows={fullRows}
                  sortable
                  colorizeValuePs
                  draftedIds={draftedIds}
                  dimDrafted={dlgShowDrafted}
                  hideDrafted={!dlgShowDrafted}
                  renderActions={(r) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onPreview(r)}
                      aria-label="Preview"
                      title="Preview"
                    >
                      <EyeIcon className="h-4 w-4 cursor-pointer hover:text-blue-500 transition-colors" />
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
              className={
                (isDrafted
                  ? "opacity-60 text-muted-foreground hover:opacity-95 hover:text-foreground "
                  : "") + band
              }
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
              {renderActions ? (
                <TableCell className="w-8">{renderActions(p)}</TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
