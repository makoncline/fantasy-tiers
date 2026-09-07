"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PlayerSourceDetails } from "./DraftSourceSelector";
import { WatchlistButton } from "./DraftWatchlistContext";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { RankedPlayer } from "@/lib/schemas";
import type { PlayerWithPick } from "@/lib/types.draft";
import { CHOICE_COMPONENT_LABELS } from "@/lib/draftChoices";
import { qk } from "@/lib/queryKeys";
import { SleeperPlayerNewsResponseSchema } from "@/lib/sleeperNews";

export type PreviewPickPlayer = RankedPlayer & Partial<Omit<PlayerWithPick, "player_id" | "name" | "position" | "team" | "bye_week" | "rank" | "tier">>;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function usePlayerNews(playerId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.sleeper.playerNews(playerId ?? ""),
    queryFn: async () => {
      const params = new URLSearchParams({
        playerId: playerId ?? "",
        limit: "3",
      });
      const res = await fetch(`/api/sleeper/player-news?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch player news");
      }
      return SleeperPlayerNewsResponseSchema.parse(await res.json()).items;
    },
    enabled: enabled && Boolean(playerId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

function PlayerNews({ playerId }: { playerId: string }) {
  const news = usePlayerNews(playerId, true);
  return <div className="text-xs">
    {news.isLoading ? <p>Loading news…</p> : news.isError ? <p>News unavailable.</p> : !news.data?.length ? <p>No recent news.</p> :
      <div className="divide-y">{news.data.slice(0, 3).map(item => <article className="space-y-1 py-2" key={`${item.source}-${item.source_key ?? item.published}`}>
        <p className="font-medium">{item.metadata.title ?? "Report"}<span className="ml-2 font-normal text-muted-foreground">{Number.isFinite(new Date(item.published).getTime()) ? dateFormat.format(new Date(item.published)) : "—"}</span></p>
        {item.metadata.description ? <p>{item.metadata.description}</p> : null}
        {item.metadata.analysis && item.metadata.analysis !== item.metadata.description ? <p>{item.metadata.analysis}</p> : null}
        {item.metadata.url ? <a className="inline-block underline" href={item.metadata.url} target="_blank" rel="noreferrer">Full report · {item.source}</a> : null}
      </article>)}</div>}
    <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" disabled={news.isFetching} onClick={() => void news.refetch()}>Refresh news</Button>
  </div>;
}

export default function PreviewPickDialog({ open, onOpenChange, player }: {
  open: boolean; onOpenChange: (open: boolean) => void; player: PreviewPickPlayer | null;
}) {
  const { playersAll, positionRows, sourceComparison, valueSource, recommendationBoard } = useDraftData();
  const [expanded, setExpanded] = useState<string[]>([]);
  const row = playersAll?.find(p => p.player_id === player?.player_id);
  const source = valueSource === "fp" ? "FantasyPros" : valueSource === "sleeper" ? "Sleeper" : "Combined";
  const metric = player ? (valueSource === "fp" || valueSource === "sleeper" ? sourceComparison?.[valueSource]?.board : recommendationBoard)?.metricsByPlayerId[player.player_id] : undefined;
  const components = Object.entries(CHOICE_COMPONENT_LABELS).flatMap(([key, label]) => {
    const value = Object.entries(metric?.components ?? {}).find(([name]) => name === key)?.[1];
    return typeof value === "number" && Number.isFinite(value) && value !== 0 ? [{ key, label, value }] : [];
  });
  const largest = components.filter(c => c.key !== "value").sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
  const overall = positionRows?.ALL?.find(p => p.player_id === player?.player_id);
  const position = player ? positionRows?.[player.position]?.find(p => p.player_id === player.player_id) : undefined;
  const tier = (p: typeof overall) => p?.tier_level ?? p?.fp_tier ?? p?.tier;
  const overallTier = tier(overall);
  const positionTier = tier(position) ?? row?.position_tier_level ?? player?.position_tier_level;
  const status = row?.sleeper_injury_status ?? player?.sleeper_injury_status ?? (metric?.availability.classification !== "healthy" ? metric?.availability.label : null);
  const depth = row?.sleeper_depth_chart_position ?? player?.sleeper_depth_chart_position;
  const depthOrder = row?.sleeper_depth_chart_order ?? player?.sleeper_depth_chart_order;
  return <Dialog open={open} onOpenChange={value => { onOpenChange(value); if (!value) setExpanded([]); }}>
    <DialogContent className="max-h-[90dvh] gap-3 overflow-y-auto p-4 sm:max-w-xl sm:p-5">
      <DialogHeader className="gap-1 text-left">
        <div className="flex flex-wrap items-center gap-2 pr-6"><DialogTitle className="capitalize">{player?.name ?? "Player"}</DialogTitle>{row ? <WatchlistButton playerId={row.player_id} name={row.name} labelled /> : null}</div>
        <DialogDescription>{player?.position ?? "—"} · {player?.team ?? "—"} · Bye {player?.bye_week ?? "—"}{status ? ` · ${status}` : ""}</DialogDescription>
      </DialogHeader>
      {depth ? <p className="text-xs text-muted-foreground">Depth: {depth}{depthOrder ?? ""}</p> : null}
      {player ? <PlayerSourceDetails playerId={player.player_id} /> : null}
      <p className="text-xs">Tier (Overall) {overallTier && overallTier > 0 ? overallTier : "—"} · Tier ({player?.position ?? "—"}) {positionTier && positionTier > 0 ? positionTier : "—"}</p>
      <p className="text-sm" data-testid="player-adjustment-summary">{largest ? `${source}: ${largest.label} has the largest adjustment (${signed(largest.value)}).` : metric ? `${source}: no nonzero adjustments.` : `${source}: adjustment data unavailable.`}</p>
      <Accordion type="multiple" value={expanded} onValueChange={setExpanded}>
        <AccordionItem value="adjustments"><AccordionTrigger className="py-2">Adjustment breakdown</AccordionTrigger><AccordionContent className="text-xs">
          <p className="mb-2 font-medium">{source} · ADJ contributions</p>
          {components.length ? <dl className="grid grid-cols-[1fr_auto] gap-1 tabular-nums">{components.map(c => <div className="contents" key={c.key}><dt>{c.label}</dt><dd>{signed(c.value)}</dd></div>)}</dl> : <p>No nonzero contributions available.</p>}
        </AccordionContent></AccordionItem>
        <AccordionItem value="news"><AccordionTrigger className="py-2">News</AccordionTrigger><AccordionContent>{open && player && expanded.includes("news") ? <PlayerNews key={player.player_id} playerId={player.player_id} /> : null}</AccordionContent></AccordionItem>
      </Accordion>
    </DialogContent>
  </Dialog>;
}
