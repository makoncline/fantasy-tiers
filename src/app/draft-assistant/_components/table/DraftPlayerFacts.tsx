"use client";
import { ComparePlayerButton } from "../DraftSelectedComparison";
import { useDraftData } from "../../_contexts/DraftDataContext";
import type { PlayerWithPick } from "@/lib/types.draft";

export function DraftPlayerFacts({ row }: { row: PlayerWithPick }) {
  const { userRosterSlots, recommendationBoard } = useDraftData();
  if (row.picked) return null;
  const peers = userRosterSlots.flatMap(s => s.player && row.bye_week != null && String(s.player.bye_week) === String(row.bye_week) ? [s.player.name] : []);
  const metric = recommendationBoard?.metricsByPlayerId[row.player_id];
  const outsideAdvice = recommendationBoard && !recommendationBoard.recommendations.some(p => p.player_id === row.player_id);
  const policy = !outsideAdvice ? null
    : row.fp_rank_ave == null ? "No advice: missing ECR"
    : metric?.availability.eligible === false ? `No advice: ${metric.availability.detail}`
    : metric?.staticValue == null ? "No advice: missing base-value input"
    : row.position === "DEF" || row.position === "K" ? "Manual only: specialist deferred by roster policy"
    : "Manual only: outside current roster policy";
  return <div className="mt-1 space-y-1 text-[11px] text-muted-foreground" data-testid={`player-facts-${row.player_id}`}>
    {peers.length ? <span title={`Shares bye ${row.bye_week} with ${peers.join(", ")}`}>Bye overlap · </span> : null}
    <ComparePlayerButton player={row} />
    {policy ? <p className="text-amber-800 dark:text-amber-300">{policy}</p> : null}
    {row.sleeper_injury_notes ? <p>{row.sleeper_injury_notes}</p> : null}
  </div>;
}
