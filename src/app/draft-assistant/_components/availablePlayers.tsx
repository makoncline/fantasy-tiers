// src/components/AvailablePlayers.tsx

import React from "react";
import type { DraftedPlayer, RankedPlayer } from "@/lib/schemas";
import type { BeerRow } from "@/lib/beersheets";
import { PlayerTable } from "./PlayerTable";
import type { PlayerRow } from "@/lib/playerRows";

import type { Extras } from "@/lib/playerRows";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { normalizePlayerName } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";
import { useDraftedLookups } from "../_lib/useDraftedLookups";
import { EyeIcon } from "lucide-react";
import { filterAvailableRows } from "@/app/draft-assistant/_lib/filterAvailableRows";

interface AvailablePlayersProps {
  availablePlayers: RankedPlayer[];
  loading: boolean;
  showAll?: boolean;
  setShowAll?: (value: boolean) => void;
  showDrafted?: boolean;
  setShowDrafted?: (value: boolean) => void;
  showUnranked?: boolean;
  setShowUnranked?: (value: boolean) => void;
}

export default function AvailablePlayers({
  availablePlayers,
  loading,
  showAll: externalShowAll,
  setShowAll: externalSetShowAll,
  showDrafted: externalShowDrafted,
  setShowDrafted: externalSetShowDrafted,
  showUnranked: externalShowUnranked,
  setShowUnranked: externalSetShowUnranked,
}: AvailablePlayersProps) {
  const { userRosterSlots, beerSheetsBoard, picks, positionRows } =
    useDraftData();
  const [open, setOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );
  const [filter, setFilter] = React.useState<
    "ALL" | "RB" | "WR" | "TE" | "QB" | "RB/WR" | "K" | "DEF"
  >("ALL");

  // Get context switches as fallback
  const {
    showAll: ctxShowAll,
    setShowAll: setCtxShowAll,
    showDrafted: ctxShowDrafted,
    setShowDrafted: setCtxShowDrafted,
    showUnranked: ctxShowUnranked,
    setShowUnranked: setCtxShowUnranked,
  } = useDraftData();

  // Use external state if provided, otherwise context, otherwise local state
  const [localShowAll, setLocalShowAll] = React.useState(false);
  const [localShowDrafted, setLocalShowDrafted] = React.useState(false);
  const [localShowUnranked, setLocalShowUnranked] = React.useState(false);

  const showAll = externalShowAll ?? ctxShowAll ?? localShowAll;
  const setShowAll = externalSetShowAll ?? setCtxShowAll ?? setLocalShowAll;
  const showDrafted = externalShowDrafted ?? ctxShowDrafted ?? localShowDrafted;
  const setShowDrafted =
    externalSetShowDrafted ?? setCtxShowDrafted ?? setLocalShowDrafted;
  const showUnranked =
    externalShowUnranked ?? ctxShowUnranked ?? localShowUnranked;
  const setShowUnranked =
    externalSetShowUnranked ?? setCtxShowUnranked ?? setLocalShowUnranked;

  // Use centralized drafted lookups hook (removes any casts)
  const { draftedIds, draftedNames } = useDraftedLookups(picks);

  // Helper to convert PlayerRow to RankedPlayer for preview
  const toRanked = (r: PlayerRow): RankedPlayer => ({
    player_id: r.player_id,
    name: r.name,
    position: r.position,
    team: r.team ?? null,
    bye_week: r.bye_week != null ? String(r.bye_week) : null,
    rank: (r.bc_rank ?? r.rank ?? 0) as number,
    tier: (r.bc_tier ?? r.tier ?? 0) as number,
  });

  const extras = React.useMemo(() => {
    const map: Record<
      string,
      { val?: number; ps?: number; ecr_round_pick?: string }
    > = {};
    (beerSheetsBoard || []).forEach((r: BeerRow) => {
      const value: { val?: number; ps?: number; ecr_round_pick?: string } = {};
      // weekly display: season VBD / 17, one decimal
      if (r.val != null && Number.isFinite(r.val)) {
        value.val = Number((r.val / SEASON_WEEKS).toFixed(1));
      }
      if (r.ps != null && Number.isFinite(r.ps)) {
        value.ps = Number(Math.round(r.ps));
      }
      // show ADP directly (not available in BeerRow)
      // ecr_round_pick remains undefined
      map[r.player_id] = value;
      const nm = normalizePlayerName(r.name || "");
      if (nm) map[nm] = value;
    });
    return map;
  }, [beerSheetsBoard]);

  // Create rowExtras object for row formatting
  const rowExtras = React.useMemo(
    () => ({
      draftedIds,
      draftedNames,
      beerSheetsMap: extras,
    }),
    [draftedIds, draftedNames, extras]
  );

  // Always source rows from enriched ALL bundle rows so toggles have full effect
  const rows = React.useMemo(() => {
    // Always start from enriched ALL rows so toggles have full effect
    return positionRows?.ALL ?? [];
  }, [positionRows]);

  const filteredRows = React.useMemo(() => {
    const result = filterAvailableRows(rows, {
      position: filter,
      showDrafted,
      showUnranked,
      draftedIds,
      draftedNames,
    });

    return result;
  }, [rows, filter, showDrafted, showUnranked, draftedIds, draftedNames]);

  // Enrich rows with pts/game (season projected pts / SEASON_WEEKS) when available
  const rowsWithPPG = React.useMemo(() => {
    const result = (() => {
      if (!beerSheetsBoard) return filteredRows;
      const byId = new Map<string, number>();
      for (const r of beerSheetsBoard) {
        if (r && r.player_id && Number.isFinite(r.proj_pts)) {
          byId.set(r.player_id, Number(r.proj_pts));
        }
      }
      return filteredRows.map((r) => {
        const proj = byId.get(r.player_id);
        return proj != null
          ? { ...r, pts_per_game: (proj / SEASON_WEEKS).toFixed(1) }
          : r;
      });
    })();

    // Log data being passed to PlayerTable
    console.log("=== AvailablePlayers Data Passed to PlayerTable ===");
    console.log("rowsWithPPG length:", result.length);
    console.log(
      "rowsWithPPG sample:",
      result.slice(0, 5).map((p) => ({
        id: p.player_id,
        name: p.name,
        position: p.position,
        bc_rank: p.bc_rank,
        pts_per_game:
          "pts_per_game" in p
            ? String((p as PlayerRow & { pts_per_game?: string }).pts_per_game)
            : "N/A",
      }))
    );

    // Check if any drafted players are in the final data
    if (draftedIds && result.length > 0) {
      const draftedInFinal = result.filter((p) =>
        draftedIds.has(String(p.player_id))
      );
      console.log("Drafted players in rowsWithPPG:", draftedInFinal.length);
      if (draftedInFinal.length > 0) {
        console.log(
          "Drafted players in rowsWithPPG sample:",
          draftedInFinal.slice(0, 3).map((p) => ({
            id: p.player_id,
            name: p.name,
            position: p.position,
          }))
        );
      }
    }
    console.log("===============================================");

    return result;
  }, [filteredRows, beerSheetsBoard, draftedIds]);

  const onPreview = (row: PlayerRow) => {
    // Convert PlayerRow to RankedPlayer for preview
    const rankedPlayer = toRanked(row);
    setPreviewPlayer(rankedPlayer);
    setOpen(true);
  };

  if (loading) return <p aria-live="polite">Loading available players...</p>;

  return (
    <>
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-4 mb-3">
        {/* Position filters */}
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "RB", "WR", "TE", "QB", "RB/WR", "K", "DEF"].map((f) => (
            <button
              key={f}
              type="button"
              className={`px-2 py-1 rounded text-xs border ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-muted"
              }`}
              onClick={() =>
                setFilter(
                  f as "ALL" | "RB" | "WR" | "TE" | "QB" | "RB/WR" | "K" | "DEF"
                )
              }
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {/* All players table - always shows all filtered rows */}
      <PlayerTable
        rows={rowsWithPPG}
        sortable
        colorizeValuePs
        dimDrafted={showDrafted} // Dim drafted players when showing them (to distinguish)
        draftedIds={draftedIds}
        hideDrafted={!showDrafted} // Hide drafted when switch is off, show when on
        renderActions={(row) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPreview(row)}
            aria-label="Preview"
            title="Preview"
          >
            <EyeIcon className="h-4 w-4 cursor-pointer hover:text-blue-500 transition-colors" />
          </Button>
        )}
      />
      <PreviewPickDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPreviewPlayer(null);
        }}
        baseSlots={userRosterSlots}
        player={previewPlayer}
      />
    </>
  );
}
