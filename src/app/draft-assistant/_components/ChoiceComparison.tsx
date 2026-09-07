"use client";
import { adjustmentLabel } from "../_lib/adjustmentLabel";
import { PlayerDisplayName, usePlayerDisplayName } from "./PlayerDisplayName";
import { formatDraftValue as score } from "./table/presets";
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
import { candidateByeNote } from "../_lib/draftTableReview";
import { DraftPickFeedStatus, useDraftPickFeedStatus } from "./DraftPickFeedStatus";
import { formatDraftPick, getChoicePickWindow } from "@/lib/draftLookaheadCore";
import {

  overallTier,
} from "@/lib/draftCardMetrics";

import type { DraftPickAction } from "../_lib/types";
import { DraftEcrValue } from "./DraftEcrValue";
import { DraftAdpCell } from "./table/DraftAdpCell";
function ChoiceRow({ choice, lean, explanation, onPick, pickDisabled, stale }: {
  choice: DraftChoice; lean: DraftChoice; explanation: string; stale: boolean;
  onPick?: (() => void) | undefined; pickDisabled?: boolean | undefined;
}) {
  const { valueSource, sourceComparison, userRosterSlots } = useDraftData();
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
        <Button variant="link" className="h-auto whitespace-normal p-0 text-left font-semibold" aria-label={`Pick details for ${player.name}`} onClick={() => setDetailsOpen(true)}><PlayerDisplayName playerId={player.player_id} name={player.name} /></Button>
        {detailsOpen ? <PreviewPickDialog open onOpenChange={setDetailsOpen} player={{ player_id: player.player_id, name: player.name, position: player.position, team: player.team, bye_week: player.bye_week, rank: player.rank ?? 0, tier: player.tier ?? 0 }} /> : null}
        <span className="ml-2"><PlayerPositionRank position={player.position} playerId={player.player_id} /></span>
        {isLean && !stale ? <span className="ml-2 text-xs font-medium">Lead</span> : null}
        <span className="block text-xs text-muted-foreground">FP Tier ({player.position}) {player.position_tier_level != null && player.position_tier_level > 0 ? player.position_tier_level : "—"}</span>
      </TableCell>
      <TableCell>{player.team ?? "—"}/{player.bye_week ?? "—"}</TableCell>
      <TableCell className="text-right">{score(points)}</TableCell>
      <TableCell className="text-right">{score(metrics.staticValue)}</TableCell>
      <TableCell className={stale ? "text-right" : "bg-primary/10 text-right font-semibold"}>{score(metrics.recommendationScore)}</TableCell>
      <TableCell className="text-right">{source === "fp" ? <DraftEcrValue rank={player.fp_rank_ave} /> : <DraftAdpCell playerId={player.player_id} adp={metrics.sleeperAdp} />}</TableCell>
      <TableCell className="w-8 p-1"><WatchlistButton playerId={player.player_id} name={player.name} /></TableCell>
    </TableRow>
    <TableRow data-testid="recommendation-reason"><TableCell colSpan={8} className="whitespace-normal pb-3 pt-0 text-xs text-muted-foreground">
      <div className="flex w-0 min-w-full flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">{explanation ? `${explanation}.` : ""}{metrics.availability.classification !== "healthy" ? <span className="ml-1 text-amber-700 dark:text-amber-300">{metrics.availability.label}.</span> : null}{metrics.availability.rankingsMayBeStale ? " News newer than rankings." : ""}</p>
        {candidateByeNote(userRosterSlots, player) ? <p>{candidateByeNote(userRosterSlots, player)}</p> : null}
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
  const displayName = usePlayerDisplayName();
  const stale = useDraftPickFeedStatus()?.warning ?? false;
  const lean = choices[0];
  const window = getChoicePickWindow(snapshot.boardInput);
  if (!lean) return null;
  const display = choices.slice(0, 3);
  const teams = snapshot.boardInput.teams;
  const higherValue = choices.find((c) => (c.metrics.staticValue ?? -Infinity) > (lean.metrics.staticValue ?? -Infinity));
  return <div className="flex flex-col gap-4" data-testid="choice-comparison">
    {stale ? <p role="status" className="font-semibold text-amber-700 dark:text-amber-300">Waiting for current picks.</p> : null}
    <DraftPickFeedStatus />
    <p className="text-xs" data-testid="draft-pick-window">{window.onClock ? "Now" : "Upcoming"} {formatDraftPick(window.ownPick, teams)}{window.state === "ready" ? ` · Next ${formatDraftPick(window.nextOwnPick, teams)} · ${window.betweenOwn} selections between` : window.state === "final" ? " · Final pick" : ""}</p>
    <Table className="w-auto border text-xs [&_th]:whitespace-nowrap [&_th]:border-r [&_th]:px-2 [&_td]:border-r [&_td]:px-2" aria-label="Recommended player comparison"><TableHeader className="bg-muted"><TableRow>{["FP Tier (Overall)", "Player", "TM/BYE", "PTS", "VAL", "ADJ", valueSource === "fp" ? "ECR" : "ADP", ""].map((label, index) => <TableHead key={label} className={index >= 3 ? "text-right" : undefined}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{display.map((choice) =>
      <ChoiceRow key={choice.player.player_id} choice={choice} lean={lean} stale={stale}
        explanation={(() => {
          const rival = choice === lean ? choices.find((c) => c !== lean) : lean;
          if (!rival) return "";
          const edge = choiceContributionDifference(choice.metrics, rival.metrics).find((d) => d.value > 0);
          return edge ? `${adjustmentLabel(edge.key, edge.label, choice.metrics).replace("Base value contribution", "Base-value component")}: +${score(edge.value)} ADJ versus ${displayName(rival.player.player_id, rival.player.name)}` : "";
        })()}
        onPick={pickAction ? () => pickAction.onPick(choice.player) : undefined}
        pickDisabled={pickAction?.disabled} />
    )}</TableBody></Table>
    {higherValue && !stale ? <p className="text-xs text-muted-foreground">Lead trades {score((higherValue.metrics.staticValue ?? 0) - (lean.metrics.staticValue ?? 0))} VAL versus {displayName(higherValue.player.player_id, higherValue.player.name)} for contextual adjustments.</p> : null}

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
