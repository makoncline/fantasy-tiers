import { useDraftData } from "../_contexts/DraftDataContext";

export function PlayerPositionRank({ position, playerId }: { position: string; playerId: string }) {
  const { valueSource, sourceComparison } = useDraftData();
  const source = valueSource === "fp" || valueSource === "sleeper" ? valueSource : null;
  const rank = source ? sourceComparison?.[source]?.positionRanksByPlayerId?.[playerId] : null;
  const valid = rank != null && Number.isInteger(rank) && rank > 0;
  const label = source === "fp" && position !== "DEF" && position !== "K" ? "FantasyPros" : "Sleeper";
  return <span className="text-xs text-muted-foreground" title={valid ? `${label} projected position rank · league scoring · includes drafted players` : "Projected position rank unavailable"}>{position}{valid ? rank : "—"}</span>;
}
