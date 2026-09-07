"use client";
import { WatchlistButton } from "./DraftWatchlistContext";
import { PlayerPositionRank } from "./PlayerPositionRank";

import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import PreviewPickDialog from "./PreviewPickDialog";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { useDraftData } from "../_contexts/DraftDataContext";
import {
  buildDraftChoices, choiceContributionDifference,
  type DraftChoice, type DraftChoiceSnapshot,
} from "@/lib/draftChoices";
import type { DraftCandidate } from "@/lib/draftCandidate";
import type { DraftValueBoard } from "@/lib/draftValue";
import NextPickTable from "./NextPickTable";
import { DraftOptionalBoundary } from "./DraftOptionalBoundary";
import { DraftPickFeedStatus } from "./DraftPickFeedStatus";
import { formatDraftPick, getChoicePickWindow } from "@/lib/draftLookaheadCore";
import {
  formatDraftMetric as score,
  overallTier,
} from "@/lib/draftCardMetrics";

import type { DraftPickAction } from "../_lib/types";
import { DraftEcrValue } from "./DraftEcrValue";
import { DraftAdpCell } from "./table/DraftAdpCell";
function ChoiceRow({ choice, lean, explanation, onPick, pickDisabled }: {
  choice: DraftChoice; lean: DraftChoice; explanation: string;
  onPick?: (() => void) | undefined; pickDisabled?: boolean | undefined;
}) {
  const { valueSource, sourceComparison } = useDraftData();
  const { player, metrics } = choice;
  const isLean = player.player_id === lean.player.player_id;
  const tier = overallTier(player);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const source = valueSource === "fp" ? "fp" : "sleeper";
  const points = sourceComparison?.[source]?.values.valuesByPlayerId[player.player_id]?.projectedPoints;
  return <Fragment>
    <TableRow data-testid="decision-recommendation-row" className="border-b-0 tabular-nums">
      <TableCell>{tier ?? "—"}</TableCell>
      <TableCell className="min-w-56 whitespace-nowrap">
        <Button variant="link" className="h-auto whitespace-normal p-0 text-left font-semibold capitalize" aria-label={`Pick details for ${player.name}`} onClick={() => setDetailsOpen(true)}>{player.name}</Button>
        {detailsOpen ? <PreviewPickDialog open onOpenChange={setDetailsOpen} player={{ player_id: player.player_id, name: player.name, position: player.position, team: player.team, bye_week: player.bye_week, rank: player.rank ?? 0, tier: player.tier ?? 0 }} /> : null}
        <span className="ml-2"><PlayerPositionRank position={player.position} rank={player.fp_rank_pos} /></span>
        <span className="block text-xs text-muted-foreground">Tier ({player.position}) {player.position_tier_level != null && player.position_tier_level > 0 ? player.position_tier_level : "—"}</span>
        {isLean ? <span className="block text-xs font-medium">Recommended</span> : null}
      </TableCell>
      <TableCell>{player.team ?? "—"}/{player.bye_week ?? "—"}</TableCell>
      <TableCell className="text-right">{score(points)}</TableCell>
      <TableCell className="text-right">{score(metrics.staticValue)}</TableCell>
      <TableCell className="bg-primary/10 text-right font-semibold">{score(metrics.recommendationScore)}</TableCell>
      <TableCell className="text-right">{source === "fp" ? <DraftEcrValue rank={player.fp_rank_ave} /> : <DraftAdpCell playerId={player.player_id} adp={metrics.sleeperAdp} />}</TableCell>
      <TableCell className="w-8 p-1"><WatchlistButton playerId={player.player_id} name={player.name} /></TableCell>
    </TableRow>
    <TableRow data-testid="recommendation-reason"><TableCell colSpan={8} className="whitespace-normal pb-3 pt-0 text-xs text-muted-foreground">
      <div className="flex w-0 min-w-full flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">{!isLean ? `${choice.reason}. ` : ""}{explanation}.{metrics.availability.classification !== "healthy" ? <span className="ml-1 text-amber-700 dark:text-amber-300">{metrics.availability.label}.</span> : null}{metrics.availability.rankingsMayBeStale ? " News newer than rankings." : ""}</p>
        <div className="flex gap-2">
          {onPick ? <Button size="sm" className="h-7" disabled={pickDisabled} onClick={onPick} aria-label={`Pick ${player.name}`}>Pick</Button> : null}
        </div>
      </div>
    </TableCell></TableRow>
  </Fragment>;
}

function ChoicePanel({ board, snapshot, pickAction }: { board: DraftValueBoard<DraftCandidate>; snapshot: DraftChoiceSnapshot; pickAction?: DraftPickAction | undefined }) {
  const choices = useMemo(() => buildDraftChoices(board), [board]);
  const { valueSource } = useDraftData();
  const lean = choices[0];
  const window = getChoicePickWindow(snapshot.boardInput);
  if (!lean) return null;
  const display = choices.slice(0, 3);
  const teams = snapshot.boardInput.teams;
  const higherValue = choices.find((c) => (c.metrics.staticValue ?? -Infinity) > (lean.metrics.staticValue ?? -Infinity));
  return <div className="flex flex-col gap-4" data-testid="choice-comparison">
    <DraftPickFeedStatus />
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-sm font-semibold">{window.onClock ? "Now" : "Upcoming"} · {formatDraftPick(window.ownPick, teams)} <span className="font-normal text-muted-foreground">#{window.ownPick ?? "—"}</span></h2>
      <p className="text-xs text-muted-foreground" data-testid="draft-pick-window">
        {window.state === "unknown" ? "Draft turn information is incomplete" : window.state === "complete" ? "Your picks are complete"
          : window.state === "final" ? "Your final pick"
          : `${window.betweenOwn} opponent selections → next ${formatDraftPick(window.nextOwnPick, teams)} (#${window.nextOwnPick})`}
      </p>
    </div>
    {window.beforeOwn != null && window.beforeOwn > 0 ? <p className="-mt-2 text-xs text-muted-foreground">
      {window.beforeOwn} opponent selection{window.beforeOwn === 1 ? "" : "s"} before your upcoming pick.
    </p> : null}
    {window.onClock && window.betweenOwn === 0 ? <p className="-mt-2 text-xs text-muted-foreground">Back-to-back picks.</p> : null}
    <Table className="w-auto text-xs" aria-label="Recommended player comparison"><TableHeader><TableRow>{["Tier (Overall)", "Player", "TM/BYE", "PTS", "VAL", "ADJ", valueSource === "fp" ? "ECR" : "ADP", ""].map((label, index) => <TableHead key={label} className={index >= 3 ? "text-right" : undefined}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{display.map((choice) =>
      <ChoiceRow key={choice.player.player_id} choice={choice} lean={lean}
        explanation={(() => {
          const rival = choice === lean ? choices.find((c) => c !== lean) : lean;
          if (!rival) return "Only comparison shown; other eligible players are in the tables";
          const edge = choiceContributionDifference(choice.metrics, rival.metrics).find((d) => d.value > 0);
          return edge ? `${edge.label} gives the largest score edge over ${rival.player.name} (+${score(edge.value)} Adj contribution)` : `No component edge over ${rival.player.name}`;
        })()}
        onPick={pickAction ? () => pickAction.onPick(choice.player) : undefined}
        pickDisabled={pickAction?.disabled} />
    )}</TableBody></Table>
    {higherValue ? <p className="text-xs text-muted-foreground">The default gives up {score((higherValue.metrics.staticValue ?? 0) - (lean.metrics.staticValue ?? 0))} Val to {higherValue.player.name}; context favors the default.</p> : null}

    {window.state === "ready" ? <DraftOptionalBoundary key={`${snapshot.projectionUpdatedAt}:${valueSource}`}><NextPickTable snapshot={snapshot} board={board} /></DraftOptionalBoundary> : null}

  </div>;
}

export default function ChoiceComparison({ pickAction }: { pickAction?: DraftPickAction | undefined } = {}) {
  const { recommendationBoard: board, choiceSnapshot: snapshot } = useDraftData();
  if (!board || !snapshot || !board.topRecommendation) return null;
  // Reset optional paths when the room, turn, or owner changes.
  const key = `${snapshot.draftId}:${snapshot.boardInput.currentPick}:${snapshot.boardInput.userSlot}`;
  return <ChoicePanel key={key} board={board} snapshot={snapshot} pickAction={pickAction} />;
}
