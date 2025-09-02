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
import { useAggregatesLastModified } from "../_lib/useDraftQueries";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { normalizePosition } from "@/lib/util";
import { PlayerTable } from "./PlayerTable";

import type { RankedPlayer } from "@/lib/schemas";
import type { PlayerWithPick } from "@/lib/types.draft";
import { findBaseline } from "@/lib/playerSorts";
import PlayersTableBase from "./table/PlayersTableBase";
import { GROUPS_COMPACT_FULL, GROUPS_COMPACT_NAMEONLY } from "./table/presets";

import PreviewPickDialog from "./PreviewPickDialog";
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
    playersByPosition,
    userRosterSlots,
    getRosterStatus,
    showAll,
    showDrafted,
    setShowDrafted,
    showUnranked,
    setShowUnranked,
  } = useDraftData();

  const { data: lastModified } = useAggregatesLastModified();

  // Use drafted lookups hook
  // Remove useDraftedLookups - using enriched data from context

  const DEFAULT_POS_TABLE_LIMIT = 10;
  const [openLabel, setOpenLabel] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );

  // Use external state if provided, otherwise use context state
  const actualShowAll = externalShowAll ?? showAll;
  const actualShowDrafted = externalShowDrafted ?? showDrafted;
  const actualSetShowDrafted = externalSetShowDrafted ?? setShowDrafted;
  const actualShowUnranked = externalShowUnranked ?? showUnranked;
  const actualSetShowUnranked = externalSetShowUnranked ?? setShowUnranked;

  const onPreview = React.useCallback(
    (row: PlayerWithPick) => {
      // Use the enriched row directly since it already has pick data
      let found = row;

      if (found && userRosterSlots && userRosterSlots.length > 0) {
        // Convert found player to RankedPlayer format
        const rankedPlayer: RankedPlayer = {
          player_id: found.player_id,
          name: found.name,
          position: found.position,
          team: found.team,
          bye_week: found.bye_week != null ? String(found.bye_week) : null,
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
    [userRosterSlots]
  );

  // Each position now uses data from the bundle

  // Use position rows from context instead of computing locally

  const sections: [string, PlayerWithPick[], "full" | "nameOnly"][] = [
    ["QB", playersByPosition?.QB ?? [], "full"],
    ["RB", playersByPosition?.RB ?? [], "full"],
    ["WR", playersByPosition?.WR ?? [], "full"],
    ["FLEX", playersByPosition?.FLEX ?? [], "full"],
    ["TE", playersByPosition?.TE ?? [], "full"],
    ["DEF", playersByPosition?.DEF ?? [], "full"],
    ["K", playersByPosition?.K ?? [], "full"],
  ];

  // sticky nav + filter controls
  const labels = sections.map(([l]) => l);
  // draftedIds is available from context
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
    const id = hasRO ? null : window.setInterval(measure, 1000);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      if (id) window.clearInterval(id);
    };
  }, []);

  // Show loading state if bundle data is not loaded
  if (!playersByPosition) {
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
        className="sticky z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ top: stickyTop }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-2 md:gap-4 px-1 py-1">
          <div className="flex flex-wrap items-center gap-3">
            {/* Switch controls moved to Draft Status Card */}
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
        <div
          className="text-xs text-muted-foreground text-right"
          data-testid="data-last-updated"
        >
          Data last updated: {lastModified?.formatted || "Loading..."}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-1">
        {sections.map(([label, rows, mode]) => {
          const limit = DEFAULT_POS_TABLE_LIMIT;
          // Optionally include only players that have a Boris Chen rank
          const eligible = actualShowUnranked
            ? rows
            : rows.filter((r) => typeof r.bc_rank === "number");
          const allRows = actualShowDrafted
            ? eligible
            : eligible.filter((r) => !r.picked);
          const visible = actualShowAll ? allRows : allRows.slice(0, limit);
          const baseline = findBaseline(rows);
          return (
            <div
              key={label}
              ref={setRef(label)}
              className="scroll-mt-24"
              style={{ scrollMarginTop: stickyTop + 16 }}
            >
              <Card className="block w-full" data-testid={`pos-card-${label}`}>
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
                    const pos = normalizePosition(label);
                    if (!pos) return null;
                    const {
                      count: rosterCount,
                      requirement: rosterReq,
                      met,
                    } = getRosterStatus(pos);
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
                    <PlayersTableBase
                      rows={visible}
                      groups={
                        mode === "nameOnly"
                          ? GROUPS_COMPACT_NAMEONLY
                          : GROUPS_COMPACT_FULL
                      }
                      sortable={false}
                      colorize={true}
                      dimDrafted={true}
                      tierRowColors={true}
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
                  {!actualShowAll && rows.length > limit ? (
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
              const pos = openLabel ? normalizePosition(openLabel) : null;
              if (!pos) return null;
              const {
                count: rosterCount,
                requirement: rosterReq,
                met,
              } = getRosterStatus(pos);
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
                  {/* Dialog toggles - use global context switches */}
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={actualShowDrafted}
                        onCheckedChange={actualSetShowDrafted}
                      />{" "}
                      <span>Show drafted</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={actualShowUnranked}
                        onCheckedChange={actualSetShowUnranked}
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
                actualShowUnranked ? true : typeof r.bc_rank === "number"
              );
              const fullRows = actualShowDrafted
                ? dlgEligible
                : dlgEligible.filter((r) => !r.picked);
              return (
                <PlayerTable
                  rows={fullRows}
                  sortable
                  colorizeValuePs
                  dimDrafted={actualShowDrafted}
                  hideDrafted={!actualShowDrafted}
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
