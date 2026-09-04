import { Badge } from "@/components/ui/badge";
import type { PlayerWithPick } from "@/lib/types.draft";

function positionRank(row: PlayerWithPick) {
  return typeof row.fp_rank_pos === "number"
    ? `${row.position}${row.fp_rank_pos}`
    : row.position;
}

export function PlayerSummaryCell({ row }: { row: PlayerWithPick }) {
  const teamBye = [
    row.team ?? "FA",
    row.bye_week != null ? `Bye ${row.bye_week}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-36 leading-tight">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{row.name}</span>
        <span className="text-[11px] text-muted-foreground">
          {positionRank(row)}
        </span>
        {row.sleeper_injury_status ? (
          <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
            {row.sleeper_injury_status}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{teamBye}</div>
    </div>
  );
}
