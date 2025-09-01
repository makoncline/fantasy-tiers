// src/components/AvailablePlayers.tsx

import React from "react";
import type { DraftedPlayer, RankedPlayer } from "@/lib/schemas";
import { PlayerTable, type PlayerRow } from "./PlayerTable";
import { toPlayerRows, type Extras } from "@/lib/playerRows";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { normalizePlayerName, ecrToRoundPick } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";
import {
  useAggregates,
  useDraftPicks,
  useSleeperPlayersMetaStatic,
} from "../_lib/useDraftQueries";
import { useDraftedLookups } from "../_lib/useDraftedLookups";
import { useSearchParams } from "next/navigation";
import { enrichPlayers } from "@/lib/enrichPlayers";
import { EyeIcon } from "lucide-react";

interface AvailablePlayersProps {
  availablePlayers: RankedPlayer[];
  loading: boolean;
  showDrafted?: boolean;
  setShowDrafted?: (value: boolean) => void;
  showUnranked?: boolean;
  setShowUnranked?: (value: boolean) => void;
}

export default function AvailablePlayers({
  availablePlayers,
  loading,
  showDrafted: externalShowDrafted,
  setShowDrafted: externalSetShowDrafted,
  showUnranked: externalShowUnranked,
  setShowUnranked: externalSetShowUnranked,
}: AvailablePlayersProps) {
  const { userRosterSlots, beerSheetsBoard, league } = useDraftData();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId") || "";
  const { data: picks } = useDraftPicks(draftId);
  const { data: sleeperMeta } = useSleeperPlayersMetaStatic(Boolean(draftId));
  const [open, setOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );
  const [filter, setFilter] = React.useState<
    "ALL" | "RB" | "WR" | "TE" | "QB" | "RB/WR" | "K" | "DEF"
  >("ALL");

  // Use external state if provided, otherwise use local state
  const [localShowDrafted, setLocalShowDrafted] = React.useState(false);
  const [localShowUnranked, setLocalShowUnranked] = React.useState(false);

  const showDrafted = externalShowDrafted ?? localShowDrafted;
  const setShowDrafted = externalSetShowDrafted ?? setLocalShowDrafted;
  const showUnranked = externalShowUnranked ?? localShowUnranked;
  const setShowUnranked = externalSetShowUnranked ?? setLocalShowUnranked;

  const { data: aggregates } = useAggregates();

  // Use centralized drafted lookups hook (removes any casts)
  const { draftedIds, draftedNames } = useDraftedLookups(picks, sleeperMeta);

  const extras = React.useMemo(() => {
    const map: Record<
      string,
      { val?: number; ps?: number; ecr_round_pick?: string }
    > = {};
    (beerSheetsBoard || []).forEach((r: any) => {
      const value = {
        // weekly display: season VBD / 17, one decimal
        val: Number.isFinite(r.val)
          ? Number((r.val / SEASON_WEEKS).toFixed(1))
          : r.val,
        ps: Number.isFinite(r.ps) ? Number(Math.round(r.ps)) : r.ps,
        // show ADP directly
        ecr_round_pick:
          r.adp != null && Number.isFinite(r.adp) ? String(r.adp) : undefined,
      } as const;
      map[r.player_id] = value;
      const nm = normalizePlayerName(r.name || "");
      if (nm) map[nm] = value;
    });
    return map;
  }, [beerSheetsBoard]);

  // Process data like PositionCompactTables does
  const process = React.useCallback((): PlayerRow[] => {
    if (!aggregates?.all || !league?.scoring) return [] as PlayerRow[];
    try {
      const enriched = enrichPlayers(aggregates.all, {
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

      // Build base rows from the enriched ALL aggregate
      const base = toPlayerRows(enriched, extras, league.teams);
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
          fp_adp: hit.fp_adp ?? undefined,
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
      return merged;
    } catch {
      return [] as PlayerRow[];
    }
  }, [aggregates, league, extras]);

  const rows = React.useMemo(() => process(), [process]);

  const filteredRows = React.useMemo(() => {
    // Apply position filter
    let filtered = rows;
    if (filter === "ALL") {
      filtered = rows;
    } else if (filter === "RB/WR") {
      filtered = rows.filter((r) => r.position === "RB" || r.position === "WR");
    } else {
      filtered = rows.filter((r) => r.position === filter);
    }

    // Apply showUnranked filter: only show players with bc_rank if showUnranked is false
    const eligible = showUnranked
      ? filtered
      : filtered.filter((r) => typeof r.bc_rank === "number");

    // Apply showDrafted filter: filter out drafted players if showDrafted is false
    const finalRows = showDrafted
      ? eligible
      : eligible.filter((r) => {
          const id = String(r.player_id);
          if (draftedIds.has(id)) return false;
          const nm = normalizePlayerName(r.name);
          if (nm && draftedNames.has(nm)) return false;
          return true;
        });

    // Sort by Boris Chen rank (same as PositionCompactTables)
    return finalRows.sort(
      (a, b) =>
        (Number(a.bc_rank ?? 1e9) as number) -
        (Number(b.bc_rank ?? 1e9) as number)
    );
  }, [rows, filter, showDrafted, showUnranked, draftedIds, draftedNames]);

  // Enrich rows with pts/game (season projected pts / SEASON_WEEKS) when available
  const rowsWithPPG = React.useMemo(() => {
    if (!beerSheetsBoard) return filteredRows;
    const byId = new Map<string, number>();
    for (const r of beerSheetsBoard as any[]) {
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
  }, [filteredRows, beerSheetsBoard]);

  const onPreview = (row: PlayerRow) => {
    // Try to find in availablePlayers first (for proper typing), then fall back to our processed data
    let found = availablePlayers.find((p) => p.player_id === row.player_id);
    if (!found) {
      // Fall back to our processed rows data
      found = rows.find((p) => p.player_id === row.player_id) as any;
    }
    if (found) {
      setPreviewPlayer(found);
      setOpen(true);
    }
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
              onClick={() => setFilter(f as any)}
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
        dimDrafted={true}
        draftedIds={draftedIds}
        hideDrafted={!showDrafted}
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
