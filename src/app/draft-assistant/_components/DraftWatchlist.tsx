"use client";

import { useState } from "react";
import { useDraftData } from "../_contexts/DraftDataContext";
import { useDraftWatchlist } from "./DraftWatchlistContext";
import { PlayerTable } from "./PlayerTable";
import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";

export function DraftWatchlist() {
  const watchlist = useDraftWatchlist();
  const { playersAll, valueSource } = useDraftData();
  const [player, setPlayer] = useState<PreviewPickPlayer | null>(null);
  const rows = playersAll.filter(row => watchlist?.ids.includes(row.player_id));
  return <section id="watch-list" aria-label="Watch list" className="scroll-mt-4 border-t py-3">
    <h2 className="mb-2 text-sm font-semibold">Watch list{rows.length ? ` (${rows.length})` : ""}</h2>
    {rows.length ? <PlayerTable rows={rows} source={valueSource} sortable colorizeValuePs dimDrafted defaultSortId="raw" defaultSortDir="desc"
      heatDomainRows={playersAll} onPlayerClick={row => setPlayer({...row, bye_week: row.bye_week == null ? null : String(row.bye_week), rank: row.rank ?? 0, tier: row.tier ?? 0})} /> : <p className="text-xs text-muted-foreground">Add players with +.</p>}
    {player ? <PreviewPickDialog open onOpenChange={open => { if (!open) setPlayer(null); }} player={player} /> : null}
  </section>;
}
