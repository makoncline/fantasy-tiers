// src/app/draft-assistant/_components/availablePlayers.tsx

import React from "react";
import type { RankedPlayer } from "@/lib/schemas";
import { PlayerTable } from "./PlayerTable";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { PlayerWithPick } from "@/lib/types.draft";
import { EyeIcon } from "lucide-react";
import { filterAvailableRows } from "@/app/draft-assistant/_lib/filterAvailableRows";
import type { DraftPickAction } from "@/app/draft-assistant/_lib/types";

const CORE_POSITION_FILTERS = ["QB", "RB", "WR", "TE"] as const;
const POSITION_FILTERS = [...CORE_POSITION_FILTERS, "K", "DEF"] as const;
type PositionFilter = (typeof POSITION_FILTERS)[number];

function allPositionsSelected(selected: ReadonlySet<PositionFilter>) {
  return POSITION_FILTERS.every((position) => selected.has(position));
}

function corePositionsSelected(selected: ReadonlySet<PositionFilter>) {
  return (
    selected.size === CORE_POSITION_FILTERS.length &&
    CORE_POSITION_FILTERS.every((position) => selected.has(position))
  );
}

function flexPositionsSelected(selected: ReadonlySet<PositionFilter>) {
  return (
    selected.size === 3 &&
    selected.has("RB") &&
    selected.has("WR") &&
    selected.has("TE")
  );
}

function specialTeamsSelected(selected: ReadonlySet<PositionFilter>) {
  return selected.size === 2 && selected.has("K") && selected.has("DEF");
}

function normalizePositionFilter(position: unknown): PositionFilter | null {
  if (typeof position !== "string") return null;
  const normalized = position.toUpperCase();
  return (
    POSITION_FILTERS.find((candidate) => candidate === normalized) ?? null
  );
}

interface AvailablePlayersProps {
  availablePlayers: RankedPlayer[]; // kept for compat, not used locally
  loading: boolean;
  showDrafted?: boolean;
  setShowDrafted?: (value: boolean) => void;
  showUnranked?: boolean;
  setShowUnranked?: (value: boolean) => void;
  pickAction?: DraftPickAction | undefined;
}

export default function AvailablePlayers({
  availablePlayers: _availablePlayers,
  loading,
  showDrafted: externalShowDrafted,
  setShowDrafted: externalSetShowDrafted,
  showUnranked: externalShowUnranked,
  setShowUnranked: externalSetShowUnranked,
  pickAction,
}: AvailablePlayersProps) {
  // Single useDraftData call with all needed properties
  const {
    playersAll,
    userRosterSlots,
    draftContext,
    draftDetails,
    picks,
    showDrafted: ctxShowDrafted,
    setShowDrafted: setCtxShowDrafted,
    showUnranked: ctxShowUnranked,
    setShowUnranked: setCtxShowUnranked,
  } = useDraftData();

  const [open, setOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] =
    React.useState<PreviewPickPlayer | null>(null);
  const [enabledPositions, setEnabledPositions] = React.useState<
    ReadonlySet<PositionFilter>
  >(() => new Set<PositionFilter>(CORE_POSITION_FILTERS));
  const valueColorDomainRef = React.useRef<PlayerWithPick[]>([]);
  if (
    valueColorDomainRef.current.length === 0 &&
    playersAll.some((player) => typeof player.draft_value_score === "number")
  ) {
    valueColorDomainRef.current = playersAll;
  }

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
  const toRanked = (r: PlayerWithPick): PreviewPickPlayer => ({
    ...r,
    player_id: r.player_id,
    name: r.name,
    position: r.position,
    team: r.team ?? null,
    bye_week: r.bye_week != null ? String(r.bye_week) : null,
    rank:
      typeof r.tier_rank === "number"
        ? r.tier_rank
        : typeof r.rank === "number"
        ? r.rank
        : 0,
    tier:
      typeof r.tier_level === "number"
        ? r.tier_level
        : typeof r.tier === "number"
        ? r.tier
        : 0,
  });

  // (deleted) PPG enrichment: compute in column accessor instead

  const togglePosition = React.useCallback((position: PositionFilter) => {
    setEnabledPositions((current) => {
      const next = new Set(current);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next.size ? next : new Set([position]);
    });
  }, []);

  const selectAllPositions = React.useCallback(
    () => setEnabledPositions(new Set<PositionFilter>(POSITION_FILTERS)),
    []
  );

  const selectCorePositions = React.useCallback(
    () => setEnabledPositions(new Set<PositionFilter>(CORE_POSITION_FILTERS)),
    []
  );

  const selectFlexPositions = React.useCallback(
    () => setEnabledPositions(new Set<PositionFilter>(["RB", "WR", "TE"])),
    []
  );

  const selectSpecialTeams = React.useCallback(
    () => setEnabledPositions(new Set<PositionFilter>(["K", "DEF"])),
    []
  );

  const teams = draftDetails?.settings?.teams ?? 0;
  const rounds = draftDetails?.settings?.rounds ?? 0;
  const made = React.useMemo(
    () => (picks || []).filter((pick) => pick && pick.player_id).length,
    [picks]
  );
  const currentRound = teams ? Math.ceil((made + 1) / teams) : 0;
  const isSpecialTeamsWindow =
    rounds > 0 && currentRound >= Math.max(1, rounds - 2);
  const starterSlotsRemaining = draftContext?.user.starterSlotsRemaining;
  const specialOpenPositions = React.useMemo(
    () =>
      starterSlotsRemaining == null
        ? []
        : (["K", "DEF"] as const).filter(
            (position) => (starterSlotsRemaining[position] ?? 0) > 0
          ),
    [starterSlotsRemaining]
  );
  const shouldFinishSpecialTeams =
    isSpecialTeamsWindow &&
    specialOpenPositions.length > 0 &&
    (draftContext?.user.totalSlotsRemaining ?? 0) <= specialOpenPositions.length;

  React.useEffect(() => {
    if (shouldFinishSpecialTeams) {
      setEnabledPositions((current) => {
        if (
          current.size === specialOpenPositions.length &&
          specialOpenPositions.every((position) => current.has(position))
        ) {
          return current;
        }
        return new Set<PositionFilter>(specialOpenPositions);
      });
      return;
    }
    if (!isSpecialTeamsWindow) return;
    setEnabledPositions((current) => {
      if (current.has("K") && current.has("DEF")) return current;
      return new Set([...current, "K", "DEF"]);
    });
  }, [isSpecialTeamsWindow, shouldFinishSpecialTeams, specialOpenPositions]);

  // Always source rows from enriched ALL bundle rows so toggles have full effect
  const rows = React.useMemo<PlayerWithPick[]>(() => {
    return playersAll.filter((player) => {
      const position = normalizePositionFilter(player.position);
      return position ? enabledPositions.has(position) : false;
    });
  }, [enabledPositions, playersAll]);

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
      <div className="relative mb-3 flex flex-wrap items-center gap-4">
        {/* Position filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={
              corePositionsSelected(enabledPositions) ? "default" : "outline"
            }
            className="h-7 px-2 text-xs"
            onClick={selectCorePositions}
            aria-pressed={corePositionsSelected(enabledPositions)}
          >
            CORE
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              allPositionsSelected(enabledPositions) ? "default" : "outline"
            }
            className="h-7 px-2 text-xs"
            onClick={selectAllPositions}
            aria-pressed={allPositionsSelected(enabledPositions)}
          >
            ALL
          </Button>
          <Button
            type="button"
            size="sm"
            variant={flexPositionsSelected(enabledPositions) ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={selectFlexPositions}
            aria-pressed={flexPositionsSelected(enabledPositions)}
          >
            FLEX
          </Button>
          <Button
            type="button"
            size="sm"
            variant={
              specialTeamsSelected(enabledPositions) ? "default" : "outline"
            }
            className="h-7 px-2 text-xs"
            onClick={selectSpecialTeams}
            aria-pressed={specialTeamsSelected(enabledPositions)}
          >
            SPECIAL
          </Button>
        </div>
        <details className="relative">
          <summary className="inline-flex h-7 cursor-pointer list-none items-center rounded-md border px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Advanced filters
          </summary>
          <div className="absolute left-0 top-9 z-40 w-72 rounded-md border bg-background p-3 shadow-lg">
            <div className="space-y-3">
              <fieldset>
                <legend className="mb-2 text-xs font-medium">Positions</legend>
                <div className="grid grid-cols-3 gap-2">
                  {POSITION_FILTERS.map((position) => (
                    <label key={position} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={enabledPositions.has(position)}
                        onCheckedChange={() => togglePosition(position)}
                      />
                      {position}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center justify-between gap-3 text-xs">
                <span>Show drafted</span>
                <Switch
                  checked={showDrafted}
                  onCheckedChange={setShowDrafted}
                  data-testid="available-toggle-show-drafted"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-xs">
                <span>Show unranked</span>
                <Switch
                  checked={showUnranked}
                  onCheckedChange={setShowUnranked}
                  data-testid="available-toggle-show-unranked"
                />
              </label>
              {!isSpecialTeamsWindow ? (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  K and DEF stay hidden from the combined board until the late
                  rounds unless selected above.
                </p>
              ) : null}
            </div>
          </div>
        </details>
      </div>
      {/* All players table - always shows all filtered rows */}
      <PlayerTable
        rows={filteredRows}
        sortable
        colorizeValuePs
        dimDrafted={showDrafted} // Dim drafted players when showing them (to distinguish)
        hideDrafted={!showDrafted} // Hide drafted when switch is off, show when on
        defaultSortId="val"
        defaultSortDir="desc"
        heatDomainRows={valueColorDomainRef.current}
        renderActions={(row) => (
          <div className="flex items-center justify-end gap-1">
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
            {pickAction ? (
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={pickAction.disabled || Boolean(row.picked)}
                aria-label={`${pickAction.label ?? "Pick"} ${row.name}`}
                data-testid={`mock-pick-${row.player_id}`}
                onClick={() => pickAction.onPick(row)}
              >
                {pickAction.label ?? "Pick"}
              </Button>
            ) : null}
          </div>
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
