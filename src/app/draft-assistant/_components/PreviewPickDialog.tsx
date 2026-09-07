"use client";

import React from "react";
import { DraftDemand } from "./DraftDemand";
import { useSelectedComparison } from "./DraftSelectedComparison";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  DraftedPlayer,
  RankedPlayer,
  RosterSlot,
} from "@/lib/schemas";
import { qk } from "@/lib/queryKeys";
import {
  SleeperPlayerNewsResponseSchema,
  type SleeperPlayerNewsItem,
} from "@/lib/sleeperNews";
import type { PlayerWithPick } from "@/lib/types.draft";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import {
  formatSleeperEcrEdge,
} from "@/app/draft-assistant/_lib/draftBoardDisplay";
import type { DraftRecommendationComponentKey } from "@/lib/draftValue";

type PreviewExtras = Partial<
  Omit<
    PlayerWithPick,
    "player_id" | "name" | "position" | "team" | "bye_week" | "rank" | "tier"
  >
>;
export type PreviewPickPlayer = RankedPlayer & PreviewExtras;

const newsDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function destinationSlot(
  baseSlots: { slot: RosterSlot; player: DraftedPlayer | null }[],
  preview: PreviewPickPlayer
) {
  if (baseSlots.some((slot) => slot.slot === preview.position && !slot.player)) {
    return preview.position;
  }
  const isFlex =
    preview.position === "RB" ||
    preview.position === "WR" ||
    preview.position === "TE";
  if (isFlex && baseSlots.some((slot) => slot.slot === "FLEX" && !slot.player)) {
    return "FLEX";
  }
  return baseSlots.some((slot) => slot.slot === "BN" && !slot.player)
    ? "BN"
    : null;
}

function fmtNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const COMPONENT_LABELS = {
  value: "League value",
  timing: "Pick timing",
  starterNeed: "Starter need",
  construction: "Roster construction",
  onesie: "QB/TE strategy",
  depth: "Roster depth and balance",
  demand: "League demand",
  risk: "Data/news risk",
} satisfies Record<DraftRecommendationComponentKey, string>;

const COMPONENT_KEYS = [
  "value",
  "timing",
  "starterNeed",
  "construction",
  "onesie",
  "depth",
  "demand",
  "risk",
] as const satisfies readonly DraftRecommendationComponentKey[];

function formatSignedScore(value: number) {
  return `${value >= 0 ? "+" : ""}${fmtNumber(value)}`;
}

function PlayerDecisionPanel({
  player,
}: {
  player: PreviewPickPlayer | null;
}) {
  const { decisionRows, recommendationBoard, positionRows } = useDraftData();
  const comparison = useSelectedComparison();
  const [referenceId, setReferenceId] = React.useState<string>("");
  if (!player) return null;

  const availability = recommendationBoard?.metricsByPlayerId[player.player_id]?.availability;
  const decisionIndex = decisionRows.findIndex(
    (row) => row.player_id === player.player_id
  );
  const overallRow = positionRows?.ALL.find((row) => row.player_id === player.player_id);
  const overallTier = overallRow?.tier_level ?? overallRow?.fp_tier ?? overallRow?.tier;
  const selectedAlternatives = comparison?.players.filter(p => p.player_id !== player.player_id && !p.picked) ?? [];
  const chosenReference = selectedAlternatives.find(p => p.player_id === referenceId) ?? selectedAlternatives[0];
  const nextOption = chosenReference ?? (
    decisionIndex >= 0
      ? decisionRows[decisionIndex + 1] ?? decisionRows[decisionIndex - 1] ?? null
      : decisionRows.find((row) => row.player_id !== player.player_id) ?? null);
  const scoreGap =
    player.draft_value_score != null && nextOption?.draft_value_score != null
      ? player.draft_value_score - nextOption.draft_value_score
      : null;
  const components = COMPONENT_KEYS.flatMap((key) => {
    const value = player.draft_component_scores?.[key];
    return typeof value === "number" && Number.isFinite(value)
      ? [{ key, label: COMPONENT_LABELS[key], value }]
      : [];
  });

  const valueGap = player.draft_raw_value_score != null && nextOption?.draft_raw_value_score != null
    ? player.draft_raw_value_score - nextOption.draft_raw_value_score : null;
  const largestDifference = COMPONENT_KEYS.flatMap(key => {
    const own = player.draft_component_scores?.[key];
    const other = nextOption?.draft_component_scores?.[key];
    return typeof own === "number" && typeof other === "number" ? [{ key, gap: own - other }] : [];
  }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];

  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <h3 className="text-sm font-semibold">Draft value</h3>
      {availability ? <div className="text-xs text-muted-foreground">
        <p>{availability.detail}</p>
        <p>{availability.newsUpdated ? `Player news updated ${new Date(availability.newsUpdated).toLocaleString()}` : "Player news timestamp unavailable"}.</p>
        {availability.rankingsMayBeStale ? <p>News is newer than the rankings; review the report before choosing.</p> : null}
      </div> : null}
      {selectedAlternatives.length ? <div className="space-y-1">
        <p className="text-xs">Compare with your selected player</p>
        <Select value={chosenReference?.player_id ?? ""} onValueChange={setReferenceId}>
          <SelectTrigger aria-label="Comparison player"><SelectValue /></SelectTrigger>
          <SelectContent>{selectedAlternatives.map(p => <SelectItem key={p.player_id} value={p.player_id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div> : null}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {player.draft_raw_value_score != null ? (
          <div>
            <div className="text-xs text-muted-foreground">VAL</div>
            <div className="font-mono">
              {fmtNumber(player.draft_raw_value_score)}
            </div>
          </div>
        ) : null}
        {player.draft_value_score != null ? (
          <div>
            <div className="text-xs text-muted-foreground">ADJ</div>
            <div className="font-mono">{fmtNumber(player.draft_value_score)}</div>
          </div>
        ) : null}
        {player.fp_rank_ave != null ? (
          <div>
            <div className="text-xs text-muted-foreground">ECR</div>
            <div className="font-mono">{fmtNumber(player.fp_rank_ave)}</div>
          </div>
        ) : null}
        {player.sleeper_adp != null ? (
          <div>
            <div className="text-xs text-muted-foreground">Platform ADP</div>
            <div className="font-mono">
              {player.sleeper_adp_round_pick ?? fmtNumber(player.sleeper_adp)}
            </div>
          </div>
        ) : null}
        {player.fp_rank_ave != null && player.sleeper_adp != null ? (
          <div>
            <div className="text-xs text-muted-foreground">ADP vs ECR</div>
            <div className="font-mono">{formatSleeperEcrEdge(player)}</div>
          </div>
        ) : null}
        {overallTier != null && overallTier > 0 ? (
          <div>
            <div className="text-xs text-muted-foreground">Overall tier</div>
            <div className="font-mono">
              {fmtNumber(overallTier)}
            </div>
          </div>
        ) : null}
        {player.position_tier_level != null ? (
          <div>
            <div className="text-xs text-muted-foreground">Position tier</div>
            <div className="font-mono">{fmtNumber(player.position_tier_level)}</div>
          </div>
        ) : null}
        <div><div className="text-xs text-muted-foreground">Room starter slots</div><DraftDemand position={player.position} /></div>
      </div>
      {components.length ? (
        <div
          className="rounded-md border bg-background/60"
          data-testid="preview-adj-breakdown"
        >
          <div className="border-b px-3 py-2 text-xs font-medium">
            Adj breakdown
          </div>
          <div className="divide-y text-xs">
            {components.map((component) => (
              <div
                key={component.key}
                className="flex items-center justify-between gap-4 px-3 py-1.5"
              >
                <span className="text-muted-foreground">{component.label}</span>
                <span className="font-mono">
                  {formatSignedScore(component.value)}
                </span>
              </div>
            ))}
            {player.draft_value_score != null ? (
              <div className="flex items-center justify-between gap-4 px-3 py-2 font-medium">
                <span>ADJ total</span>
                <span className="font-mono">{fmtNumber(player.draft_value_score)}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {nextOption ? (
        <div
          className="rounded-md border bg-background/60 p-2 text-xs text-muted-foreground"
          data-testid="preview-why-over-next"
        >
          <div className="font-medium text-foreground">
            Compared with {nextOption.name}
          </div>
          <div>
            {valueGap != null ? `${formatSignedScore(valueGap)} Val. ` : "Base-value difference unavailable. "}
            {scoreGap != null ? `${formatSignedScore(scoreGap)} Adj. ` : "Adjusted difference unavailable. "}
            {largestDifference && largestDifference.gap !== 0 ? `${COMPONENT_LABELS[largestDifference.key]} is the largest component difference (${formatSignedScore(largestDifference.gap)}).` : "No component difference is available."}
            <p className="mt-1">These are model score differences, not confidence or projected point gains. Waiting estimates are unvalidated; ADP does not establish that a player will survive.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatNewsDate(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return newsDateFormatter.format(date);
}

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

function NewsItem({ item }: { item: SleeperPlayerNewsItem }) {
  const title = item.metadata.title;
  const summary = item.metadata.description ?? item.metadata.analysis;
  const excerpt =
    summary && summary.length > 180
      ? `${summary.slice(0, 177).trimEnd()}...`
      : summary;

  return (
    <article className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {item.source}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatNewsDate(item.published)}
        </span>
      </div>
      {title ? (
        <h4 className="text-sm font-semibold leading-snug">
          {item.metadata.url ? (
            <a
              href={item.metadata.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start gap-1 hover:underline"
            >
              {title}
              <ExternalLink className="mt-0.5 size-3 shrink-0" />
            </a>
          ) : (
            title
          )}
        </h4>
      ) : null}
      {excerpt ? (
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{excerpt}</p>
      ) : null}
    </article>
  );
}

function PlayerNewsPanel({
  open,
  playerId,
}: {
  open: boolean;
  playerId: string | undefined;
}) {
  const newsQuery = usePlayerNews(playerId, open);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Newspaper className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Recent News</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void newsQuery.refetch()}
          disabled={!playerId || newsQuery.isFetching}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {!playerId ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          No player selected.
        </div>
      ) : newsQuery.isLoading ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          Loading news...
        </div>
      ) : newsQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          News status is unknown. Player news is unavailable right now.
        </div>
      ) : newsQuery.data?.length ? (
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {newsQuery.data.slice(0, 3).map((item) => (
            <NewsItem
              key={`${item.source}-${item.source_key ?? item.published}`}
              item={item}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          No recent news found.
        </div>
      )}
    </section>
  );
}

export default function PreviewPickDialog({
  open,
  onOpenChange,
  baseSlots,
  player,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  baseSlots: { slot: RosterSlot; player: DraftedPlayer | null }[];
  player: PreviewPickPlayer | null;
}) {
  const destination = React.useMemo(
    () => (player ? destinationSlot(baseSlots, player) : null),
    [baseSlots, player]
  );
  const byeConflicts = React.useMemo(
    () =>
      player?.bye_week
        ? baseSlots.flatMap((slot) =>
            slot.player?.bye_week === player.bye_week ? [slot.player.name] : []
          )
        : [],
    [baseSlots, player]
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Preview Pick {player ? `— ${player.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Check slot eligibility and source role. A depth-chart rank does not establish workload or starter quality.
          </DialogDescription>
        </DialogHeader>
        {player ? (
          <div
            className="flex flex-wrap gap-x-5 gap-y-1 border-y py-2 text-sm"
            data-testid="preview-fit-summary"
          >
            {destination ? <span>Eligible for {destination}</span> : null}
            {player.team ? <span>Team {player.team}</span> : null}
            {player.bye_week ? <span>Bye {player.bye_week}</span> : null}
            {player.sleeper_depth_chart_position ? (
              <span>
                Source depth {player.sleeper_depth_chart_position}
                {player.sleeper_depth_chart_order != null
                  ? player.sleeper_depth_chart_order
                  : ""}
              </span>
            ) : null}
            {byeConflicts.length ? (
              <span>Bye conflicts {byeConflicts.join(", ")}</span>
            ) : null}
            {player.sleeper_injury_status ? (
              <span>Status {player.sleeper_injury_status}</span>
            ) : null}
            {player.draft_availability_label ? (
              <span>Availability {player.draft_availability_label}</span>
            ) : null}
            {player.sleeper_injury_notes ? (
              <span>{player.sleeper_injury_notes}</span>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <PlayerDecisionPanel key={player?.player_id} player={player} />
          </div>
          <PlayerNewsPanel open={open} playerId={player?.player_id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
