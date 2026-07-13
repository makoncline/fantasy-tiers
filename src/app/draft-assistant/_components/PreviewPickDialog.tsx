"use client";

import React from "react";
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

function fmtSignedRounds(value: number) {
  return `${value > 0 ? "+" : ""}${value} rd`;
}

function fmtProbability(value: number) {
  return `${Math.round(value * 100)}%`;
}

function isUsefulCopy(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "unknown" && normalized !== "—";
}

function isSpecificDataNote(value: string) {
  return isUsefulCopy(value) && !/^source warning\b/i.test(value.trim());
}

function ExplanationList({
  label,
  values,
}: {
  label: string;
  values: readonly string[] | undefined;
}) {
  const visibleValues = values?.filter((value) =>
    label === "Data" ? isSpecificDataNote(value) : isUsefulCopy(value)
  );
  if (!visibleValues?.length) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
        {visibleValues.map((value) => (
          <li key={`${label}-${value}`}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

function PlayerDecisionPanel({
  player,
}: {
  player: PreviewPickPlayer | null;
}) {
  const { decisionRows } = useDraftData();
  if (!player) return null;

  const decisionIndex = decisionRows.findIndex(
    (row) => row.player_id === player.player_id
  );
  const nextOption =
    decisionIndex >= 0
      ? decisionRows[decisionIndex + 1] ?? decisionRows[decisionIndex - 1] ?? null
      : decisionRows.find((row) => row.player_id !== player.player_id) ?? null;
  const comparisonIsHigher =
    nextOption != null &&
    decisionIndex > 0 &&
    nextOption.player_id === decisionRows[decisionIndex - 1]?.player_id;
  const scoreGap =
    player.draft_value_score != null && nextOption?.draft_value_score != null
      ? player.draft_value_score - nextOption.draft_value_score
      : null;

  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <div>
          <h3 className="text-sm font-semibold">Draft Value</h3>
          {isUsefulCopy(player.draft_action_label) ||
          (player.draft_comeback_label &&
            player.draft_comeback_probability != null) ? (
            <p className="text-xs text-muted-foreground">
              {[
                isUsefulCopy(player.draft_action_label)
                  ? player.draft_action_label
                  : null,
                player.draft_comeback_label &&
                player.draft_comeback_probability != null
                  ? `comeback ${player.draft_comeback_label} ${fmtProbability(player.draft_comeback_probability)}`
                  : null,
              ]
                .filter((value): value is string => Boolean(value))
                .join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {player.draft_value_score != null ? (
          <div>
            <div className="text-xs text-muted-foreground">VAL</div>
            <div className="font-mono">{fmtNumber(player.draft_value_score)}</div>
          </div>
        ) : null}
        {player.fp_rank_ave != null ? (
          <div>
            <div className="text-xs text-muted-foreground">ECR</div>
            <div className="font-mono">{fmtNumber(player.fp_rank_ave)}</div>
          </div>
        ) : null}
        {player.draft_adp_delta_rounds != null ? (
          <div>
            <div className="text-xs text-muted-foreground">ADP Δ</div>
            <div className="font-mono">
              {fmtSignedRounds(player.draft_adp_delta_rounds)}
            </div>
          </div>
        ) : null}
        {(player.tier_level ?? player.fp_tier ?? player.tier) > 0 ? (
          <div>
            <div className="text-xs text-muted-foreground">Overall tier</div>
            <div className="font-mono">
              {fmtNumber(player.tier_level ?? player.fp_tier ?? player.tier)}
            </div>
          </div>
        ) : null}
        {player.position_tier_level != null ? (
          <div>
            <div className="text-xs text-muted-foreground">Position tier</div>
            <div className="font-mono">{fmtNumber(player.position_tier_level)}</div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {(player.draft_reason_labels ?? [])
          .filter((reason) => isUsefulCopy(reason) && reason !== "Source warning")
          .map((reason) => (
          <Badge key={reason} variant="outline">
            {reason}
          </Badge>
          ))}
      </div>
      {player.draft_recommendation_edge_detail ? (
        <p className="text-xs text-muted-foreground">
          {player.draft_recommendation_edge_detail}
        </p>
      ) : null}
      <div className="grid gap-2 md:grid-cols-2">
        <ExplanationList
          label="Pros"
          values={player.draft_recommendation_pros}
        />
        <ExplanationList
          label="Cons"
          values={player.draft_recommendation_cons}
        />
      </div>
      <ExplanationList label="Data" values={player.draft_data_quality_notes} />
      {nextOption ? (
        <div
          className="rounded-md border bg-background/60 p-2 text-xs text-muted-foreground"
          data-testid="preview-why-over-next"
        >
          <div className="font-medium text-foreground">
            {comparisonIsHigher ? "Compared with" : "Why over"} {nextOption.name}
          </div>
          <div>
            {scoreGap != null
              ? `${scoreGap >= 0 ? "+" : ""}${fmtNumber(
                  scoreGap
                )} VAL. `
              : "Adjacent recommendation. "}
            {player.draft_recommendation_edge_detail ??
              player.draft_recommendation_summary ??
              (player.draft_reason_details ?? []).slice(0, 2).join(" ")}
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
          Player news is unavailable right now.
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
            Preview how this player would fit into your current roster.
          </DialogDescription>
        </DialogHeader>
        {player ? (
          <div
            className="flex flex-wrap gap-x-5 gap-y-1 border-y py-2 text-sm"
            data-testid="preview-fit-summary"
          >
            {destination ? <span>Fits {destination}</span> : null}
            {player.team ? <span>Team {player.team}</span> : null}
            {player.bye_week ? <span>Bye {player.bye_week}</span> : null}
            {byeConflicts.length ? (
              <span>Bye conflicts {byeConflicts.join(", ")}</span>
            ) : null}
            {player.sleeper_injury_status ? (
              <span>Status {player.sleeper_injury_status}</span>
            ) : null}
            {player.sleeper_injury_notes ? (
              <span>{player.sleeper_injury_notes}</span>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <PlayerDecisionPanel player={player} />
          </div>
          <PlayerNewsPanel open={open} playerId={player?.player_id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
