export function PlayerPositionRank({ position, rank }: { position: string; rank?: number | null | undefined }) {
  const valid = rank != null && Number.isInteger(rank) && rank > 0;
  return <span className="text-xs text-muted-foreground" title={valid ? "FantasyPros position rank" : "Position rank unavailable"}>{position}{valid ? rank : "—"}</span>;
}
