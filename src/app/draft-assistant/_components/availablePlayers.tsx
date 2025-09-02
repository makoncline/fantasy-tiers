// src/app/draft-assistant/_components/availablePlayers.tsx

import React from "react";
import type { RankedPlayer } from "@/lib/schemas";
import { PlayerTable } from "./PlayerTable";

import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { PlayerWithPick } from "@/lib/types.draft";
import { EyeIcon } from "lucide-react";
import { filterAvailableRows } from "@/app/draft-assistant/_lib/filterAvailableRows";

const FILTERS = ["ALL", "RB", "WR", "TE", "QB", "RB/WR", "K", "DEF"] as const;
type Filter = (typeof FILTERS)[number];

interface AvailablePlayersProps {
  availablePlayers: RankedPlayer[]; // kept for compat, not used locally
  loading: boolean;
  showDrafted?: boolean;
  setShowDrafted?: (value: boolean) => void;
  showUnranked?: boolean;
  setShowUnranked?: (value: boolean) => void;
}

export default function AvailablePlayers({
  availablePlayers: _availablePlayers,
  loading,
  showDrafted: externalShowDrafted,
  setShowDrafted: externalSetShowDrafted,
  showUnranked: externalShowUnranked,
  setShowUnranked: externalSetShowUnranked,
}: AvailablePlayersProps) {
  // Single useDraftData call with all needed properties
  const {
    playersAll,
    playersByPosition,
    userRosterSlots,
    showDrafted: ctxShowDrafted,
    setShowDrafted: setCtxShowDrafted,
    showUnranked: ctxShowUnranked,
    setShowUnranked: setCtxShowUnranked,
  } = useDraftData();

  const [open, setOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );
  const [filter, setFilter] = React.useState<Filter>("ALL");

  // Use external state if provided, otherwise context, otherwise local state
  const [localShowDrafted, setLocalShowDrafted] = React.useState(false);
  const [localShowUnranked, setLocalShowUnranked] = React.useState(false);

  // showAll UI isn't used in this component; keep local state but don't derive helpers
  const showDrafted = externalShowDrafted ?? ctxShowDrafted ?? localShowDrafted;
  const setShowDrafted =
    externalSetShowDrafted ?? setCtxShowDrafted ?? setLocalShowDrafted;
  const showUnranked =
    externalShowUnranked ?? ctxShowUnranked ?? localShowUnranked;
  const setShowUnranked =
    externalSetShowUnranked ?? setCtxShowUnranked ?? setLocalShowUnranked;

  // Helper to convert PlayerWithPick to RankedPlayer for preview
  const toRanked = (r: PlayerWithPick): RankedPlayer => ({
    player_id: r.player_id,
    name: r.name,
    position: r.position,
    team: r.team ?? null,
    bye_week: r.bye_week != null ? String(r.bye_week) : null,
    rank: (r.bc_rank ?? r.rank ?? 0) as number,
    tier: (r.bc_tier ?? r.tier ?? 0) as number,
  });

  // (deleted) PPG enrichment: compute in column accessor instead

  // Always source rows from enriched ALL bundle rows so toggles have full effect
  const rows = React.useMemo<PlayerWithPick[]>(() => {
    switch (filter) {
      case "ALL":
        return playersAll;
      case "RB/WR":
        return [
          ...(playersByPosition?.RB ?? []),
          ...(playersByPosition?.WR ?? []),
        ];
      default:
        return (
          (playersByPosition &&
            (playersByPosition as Record<string, PlayerWithPick[]>)[filter]) ||
          []
        );
    }
  }, [playersAll, playersByPosition, filter]);

  const filteredRows = React.useMemo(
    () =>
      filterAvailableRows(rows, {
        showDrafted,
        showUnranked,
      }),
    [rows, showDrafted, showUnranked]
  );

  const onPreview = (row: PlayerWithPick) => {
    // Convert PlayerWithPick to RankedPlayer for preview
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
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`px-2 py-1 rounded text-xs border ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-muted"
              }`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {/* All players table - always shows all filtered rows */}
      <PlayerTable
        rows={filteredRows}
        sortable
        colorizeValuePs
        dimDrafted={showDrafted} // Dim drafted players when showing them (to distinguish)
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
