"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDraftData } from "@/app/draft-assistant/_contexts/DraftDataContext";
import type { DraftPickAction } from "../_lib/types";
import ChoiceComparison from "./ChoiceComparison";

const DEMAND_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
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

export default function DecisionBoard({ pickAction }: { pickAction?: DraftPickAction | undefined } = {}) {
  const {
    decisionRows,
    topRecommendation,
    rosterConstruction,
    draftContext,
  } = useDraftData();

  if (!decisionRows.length) return null;

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
  const open = [...coreOpen, ...(rosterConstruction?.flexOpen ? [`${rosterConstruction.flexOpen} FLEX`] : []), ...specialOpen.map((p) => p === "DEF" ? "D/ST" : p)];
  const focus = open.length ? `Open: ${open.join(", ")}` : "Starting slots covered";
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
    <Card id="decision-board" data-testid="decision-board" className="scroll-mt-40">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <CardTitle>Your choices</CardTitle>
          <Badge className="w-fit" variant="default">
            {focus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ChoiceComparison pickAction={pickAction} />
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
            <div className="flex flex-col gap-3">
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
