// src/components/AvailablePlayers.tsx

import React from "react";
import type { DraftedPlayer, RankedPlayer } from "@/lib/schemas";
import { PlayerTable, mapToPlayerRow, type PlayerRow } from "./PlayerTable";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import { normalizePlayerName, ecrToRoundPick } from "@/lib/util";
import { SEASON_WEEKS } from "@/lib/constants";
import { useCombinedAggregateAll } from "../_lib/useDraftQueries";
import enrichPlayers from "@/lib/enrichPlayers";

interface AvailablePlayersProps {
  availablePlayers: RankedPlayer[];
  loading: boolean;
}

export default function AvailablePlayers({
  availablePlayers,
  loading,
}: AvailablePlayersProps) {
  if (loading) return <p aria-live="polite">Loading available players...</p>;
  const { userRosterSlots, beerSheetsBoard, league } = useDraftData();
  const DEFAULT_ALL_PLAYERS_LIMIT = 20;
  const [showAll, setShowAll] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [previewPlayer, setPreviewPlayer] = React.useState<RankedPlayer | null>(
    null
  );
  const [filter, setFilter] = React.useState<
    "ALL" | "RB" | "WR" | "TE" | "QB" | "RB/WR" | "K" | "DEF"
  >("ALL");
  const { data: combinedAll } = useCombinedAggregateAll(true);

  const extras = React.useMemo(() => {
    const map: Record<
      string,
      { val?: number; ps?: number; ecr_round_pick?: string }
    > = {};
    (beerSheetsBoard || []).forEach((r) => {
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

  // Build base rows
  const rows = mapToPlayerRow(availablePlayers, extras);

  // Enrich from combined aggregate + league when available
  const enrichedMap = React.useMemo(() => {
    const dataset = combinedAll;
    if (!dataset || !league?.scoring) return null;
    try {
      const playersArray = Object.values(dataset);
      const enriched = enrichPlayers(playersArray, {
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
      return { byId, byName };
    } catch {
      return null;
    }
  }, [combinedAll, league?.teams, league?.scoring, league?.roster]);

  const filteredRows = React.useMemo(() => {
    // Merge enrichment into base rows prior to filtering
    const merged = rows.map((r) => {
      if (!enrichedMap) return r;
      const hit =
        enrichedMap.byId.get(r.player_id) ||
        enrichedMap.byName.get(normalizePlayerName(r.name));
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
            ? ecrToRoundPick(Number(hit.fp_rank_overall), Number(league.teams))
            : undefined,
        fp_adp: hit.fp_adp ?? undefined,
        fp_rank_overall: hit.fp_rank_overall ?? undefined,
        fp_rank_pos: hit.fp_rank_pos ?? undefined,
        fp_tier: hit.fp_tier ?? undefined,
        fp_baseline_pts: hit.fp_baseline_pts ?? undefined,
        fp_value: hit.fp_value ?? undefined,
        fp_positional_scarcity_slope: hit.fp_positional_scarcity_slope ?? undefined,
        fp_player_owned_avg: hit.fp_player_owned_avg ?? undefined,
        market_delta: hit.market_delta ?? undefined,
      } as PlayerRow;
    });

    if (filter === "ALL") return merged;
    if (filter === "RB/WR")
      return merged.filter((r) => r.position === "RB" || r.position === "WR");
    return merged.filter((r) => r.position === filter);
  }, [rows, filter, enrichedMap]);

  // Enrich rows with pts/game (season projected pts / SEASON_WEEKS) when available
  const rowsWithPPG = React.useMemo(() => {
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
  }, [filteredRows, beerSheetsBoard]);


  const onPreview = (row: PlayerRow) => {
    const found = availablePlayers.find((p) => p.player_id === row.player_id);
    if (found) {
      setPreviewPlayer(found);
      setOpen(true);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
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
      {/* All players table */}
      <PlayerTable
        rows={showAll ? rowsWithPPG : rowsWithPPG.slice(0, DEFAULT_ALL_PLAYERS_LIMIT)}
        sortable
        colorizeValuePs
        renderActions={(row) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPreview(row)}
            aria-label="Preview"
            title="Preview"
          >
            {/* eye icon */}
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
      {rowsWithPPG.length > DEFAULT_ALL_PLAYERS_LIMIT ? (
        <div className="mt-3">
          <Button variant="ghost" className="w-full" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show Less" : "Show More"}
          </Button>
        </div>
      ) : null}
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
