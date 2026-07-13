"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { PlayerWithPick } from "@/lib/types.draft";

function formatScore(value: number | null | undefined) {
  if (value == null) return "—";
  return String(Math.round(value * 10) / 10);
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildFocus(args: {
  coreOpen: string[];
  specialOpen: string[];
  flexOpen: number;
  benchSlotsRemaining: number;
  totalSlotsRemaining: number;
  topReasons: readonly string[];
}) {
  if (args.totalSlotsRemaining > 0 && args.totalSlotsRemaining <= args.specialOpen.length) {
    return `${args.specialOpen.join("/")} only remains`;
  }
  if (args.coreOpen.length) return `Fill ${args.coreOpen.join("/")}`;
  if (args.flexOpen > 0) return "Protect FLEX quality";
  if (args.topReasons.includes("WR2 anchor")) return "Protect WR2";
  if (args.topReasons.includes("WR starter")) return "Protect WR/FLEX";
  if (args.benchSlotsRemaining > 0) return "RB/WR bench upside";
  return "Review best value";
}

const DEMAND_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
const CLOSE_OPTION_SCORE_GAP = 5;

function RecommendationCard({
  player,
  label,
  gapFromTop,
  primary = false,
}: {
  player: PlayerWithPick;
  label: string;
  gapFromTop?: number;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${primary ? "bg-primary/5" : "bg-muted/20"}`}
      data-testid="decision-recommendation-card"
    >
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold leading-tight">
            {player.name}
          </span>
          <Badge variant="outline">
            {player.position}
            {player.fp_rank_pos ? `${player.fp_rank_pos}` : ""}
          </Badge>
          <Badge variant="outline">
            VAL {formatScore(player.draft_value_score)}
          </Badge>
          <Badge variant="secondary">
            {player.draft_recommendation_edge ?? "Review"}
            {gapFromTop != null
              ? ` · ${formatScore(gapFromTop)} from top`
              : player.draft_recommendation_score_gap != null
                ? ` · +${formatScore(player.draft_recommendation_score_gap)} vs next`
                : ""}
          </Badge>
        </div>
        {player.draft_recommendation_edge_detail ? (
          <p
            className="mt-2 max-w-3xl text-sm text-foreground/80"
            data-testid={
              primary ? "decision-recommendation-summary" : undefined
            }
          >
            {player.draft_recommendation_edge_detail}
          </p>
        ) : null}
        <div className="mt-2 space-y-1">
          <SignalList label="Pros" values={player.draft_recommendation_pros} />
          <SignalList
            label="Cons"
            values={player.draft_recommendation_cons}
            variant="secondary"
          />
          <SignalList
            label="Data"
            values={player.draft_data_quality_notes}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}

function flexStarterShare(
  position: (typeof DEMAND_POSITIONS)[number],
  flexSlots: number
) {
  if (position === "RB" || position === "WR") return flexSlots * 0.45;
  if (position === "TE") return flexSlots * 0.1;
  return 0;
}

function formatDemand(value: number) {
  if (value <= 0) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function demandRatioWidth(remaining: number, initial: number) {
  if (remaining <= 0 || initial <= 0) return "0%";
  return `${Math.max(4, Math.min(100, (remaining / initial) * 100))}%`;
}

function demandText(remaining: number, initial: number) {
  if (initial <= 0) return "—";
  return `${formatDemand(remaining)}/${formatDemand(initial)}`;
}

function DemandBars({
  title,
  rows,
  barClassName,
}: {
  title: string;
  rows: {
    position: (typeof DEMAND_POSITIONS)[number];
    remaining: number;
    initial: number;
  }[];
  barClassName: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="grid max-w-[34rem] gap-2">
        {rows.map((row) => (
          <div
            key={`${title}-${row.position}`}
            className="grid grid-cols-[3ch_minmax(0,24rem)_9ch] items-center gap-2 text-xs"
          >
            <div className="font-medium">{row.position}</div>
            <div
              className="h-2 overflow-hidden rounded bg-muted"
              title={`${title} ${row.position}: ${demandText(
                Math.min(row.remaining, row.initial),
                row.initial
              )} remaining`}
            >
              <div
                className={`h-full ${barClassName}`}
                style={{
                  width: demandRatioWidth(
                    Math.min(row.remaining, row.initial),
                    row.initial
                  ),
                }}
              />
            </div>
            <div className="text-right tabular-nums text-muted-foreground">
              {demandText(Math.min(row.remaining, row.initial), row.initial)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalList({
  label,
  values,
  variant = "outline",
}: {
  label: string;
  values: readonly string[] | undefined;
  variant?: "default" | "secondary" | "outline";
}) {
  if (!values?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}:
      </span>
      {values.map((value) => (
        <Badge key={`${label}-${value}`} variant={variant}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

export default function DecisionBoard() {
  const {
    decisionRows,
    topRecommendation,
    rosterConstruction,
    draftContext,
  } = useDraftData();

  if (!decisionRows.length) return null;

  const topRows = decisionRows.slice(0, 4);
  const topReasons = unique(
    topRows.flatMap((row) => row.draft_reason_labels ?? [])
  );
  const topRecommendationScore = topRecommendation?.draft_value_score;
  const closeOptions =
    topRecommendationScore == null
      ? []
      : decisionRows.slice(1).flatMap((row) => {
          if (row.draft_value_score == null) return [];
          const gap = Math.round(
            (topRecommendationScore - row.draft_value_score) * 10
          ) / 10;
          if (gap < 0 || gap > CLOSE_OPTION_SCORE_GAP) return [];
          return [{ row, gap }];
        });
  const starterSlots = draftContext?.user.starterSlotsRemaining;
  const coreOpen =
    starterSlots == null
      ? rosterConstruction?.starterHoles ?? []
      : (["QB", "RB", "WR", "TE"] as const).filter(
          (position) => (starterSlots[position] ?? 0) > 0
        );
  const specialOpen =
    starterSlots == null
      ? []
      : (["K", "DEF"] as const).filter(
          (position) => (starterSlots[position] ?? 0) > 0
        );
  const focus = buildFocus({
    coreOpen,
    specialOpen,
    flexOpen: rosterConstruction?.flexOpen ?? 0,
    benchSlotsRemaining: draftContext?.user.benchSlotsRemaining ?? 0,
    totalSlotsRemaining: draftContext?.user.totalSlotsRemaining ?? 0,
    topReasons,
  });
  const demandRows =
    draftContext == null
      ? []
      : DEMAND_POSITIONS.map((position) => {
          const starterInitial =
            (draftContext.room.leagueStarterSlotsInitial[position] ?? 0) +
            flexStarterShare(
              position,
              draftContext.room.leagueStarterSlotsInitial.FLEX
            );
          const starterRemaining =
            (draftContext.room.leagueStarterSlotsRemaining[position] ?? 0) +
            flexStarterShare(
              position,
              draftContext.room.leagueStarterSlotsRemaining.FLEX
            );
          const benchInitial =
            draftContext.room.leagueBenchDemandInitialByPosition[position] ?? 0;
          const benchRemaining =
            draftContext.room.leagueBenchDemandByPosition[position] ?? 0;
          return {
            position,
            starterInitial,
            starterRemaining,
            benchInitial,
            benchRemaining,
          };
        })
        .filter((row) => row.starterInitial > 0);

  return (
    <Card id="decision-board" data-testid="decision-board">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <CardTitle>Pick Insights</CardTitle>
          <Badge className="w-fit" variant="default">
            {focus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {topRecommendation ? (
          <div className="space-y-3">
            <RecommendationCard
              player={topRecommendation}
              label="Recommended Pick"
              primary
            />
            {closeOptions.length ? (
              <div
                className="space-y-2"
                data-testid="decision-close-options"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Close recommendations
                </div>
                {closeOptions.map(({ row, gap }) => (
                  <RecommendationCard
                    key={row.player_id}
                    player={row}
                    label="Close Option"
                    gapFromTop={gap}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {demandRows.length ? (
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-muted-foreground">
                League starter needs
              </div>
              <div className="text-[11px] text-muted-foreground">
                Still needed / starting need
              </div>
            </div>
            <div className="space-y-3">
              <DemandBars
                title="Starter slots"
                rows={demandRows.map((row) => ({
                  position: row.position,
                  remaining: row.starterRemaining,
                  initial: row.starterInitial,
                }))}
                barClassName="bg-primary"
              />
            </div>
          </div>
        ) : null}
        {topRecommendation?.draft_component_labels?.length ? (
          <details className="rounded-md border bg-muted/10 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Recommendation diagnostics
            </summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {topRecommendation.draft_weight_profile_label ? (
                <Badge variant="outline">
                  {topRecommendation.draft_weight_profile_label}
                </Badge>
              ) : null}
              {topRecommendation.draft_component_labels.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
