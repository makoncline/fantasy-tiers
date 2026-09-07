"use client";
import { PlayerDisplayName } from "./PlayerDisplayName";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import PreviewPickDialog, { type PreviewPickPlayer } from "./PreviewPickDialog";
import { formatDraftValue as formatDraftMetric } from "./table/presets";
import { WatchlistButton } from "./DraftWatchlistContext";
import { PlayerPositionRank } from "./PlayerPositionRank";
import { useQuery } from "@tanstack/react-query";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { qk } from "@/lib/queryKeys";
import { buildDraftLookahead } from "@/lib/draftLookahead";
import { formatDraftPick, getChoicePickWindow } from "@/lib/draftLookaheadCore";
import { overallTier } from "@/lib/draftCardMetrics";
import type { DraftChoiceSnapshot } from "@/lib/draftChoices";
import type { DraftCandidate } from "@/lib/draftCandidate";
import type { DraftValueBoard } from "@/lib/draftValue";
import { useDraftData } from "../_contexts/DraftDataContext";
import { DraftEcrValue } from "./DraftEcrValue";

export default function NextPickTable({ snapshot, board }: { snapshot: DraftChoiceSnapshot; board: DraftValueBoard<DraftCandidate> }) {
  const { valueSource, sourceComparison } = useDraftData();
  const [detailsPlayer, setDetailsPlayer] = useState<PreviewPickPlayer | null>(null);
  const first = board.topRecommendation?.player;
  const window = getChoicePickWindow(snapshot.boardInput);
  const query = useQuery({
    queryKey: qk.draftNext(snapshot, first?.player_id ?? ""),
    enabled: first != null && window.state === "ready",
    queryFn: async ({ signal }) => {
      // Yield once so the current-pick table can paint before the optional work.
      await new Promise(resolve => setTimeout(resolve, 0));
      signal.throwIfAborted();
      if (!first) throw new Error("No current recommendation");
      return buildDraftLookahead(snapshot, first.player_id, board);
    },
    staleTime: Infinity, gcTime: 60_000, retry: false,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const result = query.data;
  const source = valueSource === "fp" ? "fp" : "sleeper";
  return <section aria-label="Next-turn available players" className="flex flex-col gap-2 border-t pt-3" data-testid="next-pick-table">
    <h2 className="text-sm font-semibold">Next-pick scenario · {formatDraftPick(window.nextOwnPick, snapshot.boardInput.teams)}</h2>
    <p className="text-xs text-muted-foreground">After <span >{first ? <PlayerDisplayName playerId={first.player_id} name={first.name} /> : "—"}</span>; assumes opponents follow market order.</p>
    {query.isPending ? <p role="status" className="text-xs">Loading next-turn options…</p> : query.isError ? <p role="status" className="text-xs">Next-turn preview unavailable. Current recommendations are unchanged.</p>
      : result?.scenario.status !== "ready" ? <p className="text-xs">{result?.scenario.message}</p>
      : !result.choices.length ? <p className="text-xs">No eligible options remain in this scenario.</p>
      : <Table className="w-auto border text-xs [&_th]:whitespace-nowrap [&_th]:border-r [&_th]:px-2 [&_td]:border-r [&_td]:px-2" aria-label="Next-turn player comparison"><TableHeader className="bg-muted"><TableRow>{["FP Tier (Overall)", "Player", "TM/BYE", "PTS", "VAL", "Scenario ADJ", source === "fp" ? "ECR" : "ADP", ""].map((label, index) => <TableHead className={index >= 3 ? "text-right" : undefined} key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
        {result.choices.slice(0, 5).map(({ player, metrics }) => <TableRow key={player.player_id} className="tabular-nums">
          <TableCell>{overallTier(player) ?? "—"}</TableCell>
          <TableCell className="min-w-56 whitespace-nowrap"><Button variant="link" className="h-auto p-0 font-medium" onClick={() => setDetailsPlayer({ player_id: player.player_id, name: player.name, position: player.position, team: player.team, bye_week: player.bye_week, rank: player.rank ?? 0, tier: player.tier ?? 0 })}><PlayerDisplayName playerId={player.player_id} name={player.name} /></Button>{metrics.availability.classification !== "healthy" ? <span className="ml-1 text-amber-600" title={metrics.availability.label} aria-label={metrics.availability.label}>!</span> : null} <PlayerPositionRank position={player.position} playerId={player.player_id} /><span className="block text-xs text-muted-foreground">FP Tier ({player.position}) {player.position_tier_level != null && player.position_tier_level > 0 ? player.position_tier_level : "—"}</span></TableCell>
          <TableCell>{player.team ?? "—"}/{player.bye_week ?? "—"}</TableCell>
          <TableCell className="text-right">{formatDraftMetric(sourceComparison?.[source]?.values.valuesByPlayerId[player.player_id]?.projectedPoints)}</TableCell>
          <TableCell className="text-right">{formatDraftMetric(metrics.staticValue)}</TableCell>
          <TableCell className="text-right">{formatDraftMetric(metrics.recommendationScore)}</TableCell>
          <TableCell className="text-right">{source === "fp" ? <DraftEcrValue rank={player.fp_rank_ave} /> : formatDraftPick(metrics.sleeperAdp == null ? null : Math.round(metrics.sleeperAdp), snapshot.boardInput.teams)}</TableCell>
          <TableCell className="w-8 p-1"><WatchlistButton playerId={player.player_id} name={player.name} /></TableCell>
        </TableRow>)}
      </TableBody></Table>}
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Scenario assumptions</summary><p>Removes the current lead, then {window.betweenOwn ?? "—"} players in market order. ADJ uses the resulting board. This scenario does not estimate survival odds or establish a better two-pick path.</p></details>
    {detailsPlayer ? <PreviewPickDialog open currentPickDetails player={detailsPlayer} onOpenChange={open => { if (!open) setDetailsPlayer(null); }} /> : null}
  </section>;
}
