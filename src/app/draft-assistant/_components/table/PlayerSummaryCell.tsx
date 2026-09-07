import { PlayerDisplayName } from "../PlayerDisplayName";
import { PlayerPositionRank } from "../PlayerPositionRank";
import { Button } from "@/components/ui/button";
import type { PlayerWithPick } from "@/lib/types.draft";

export function PlayerSummaryCell({ row, onOpen }: { row: PlayerWithPick; onOpen?: ((row: PlayerWithPick) => void) | undefined }) {
  return <div className="flex items-center gap-1.5 whitespace-nowrap">
    {onOpen ? <Button variant="ghost" className="h-auto justify-start p-0 font-medium" onClick={() => onOpen(row)} aria-label={`Details for ${row.name}`}><PlayerDisplayName playerId={row.player_id} name={row.name} /></Button> : <span className="font-medium"><PlayerDisplayName playerId={row.player_id} name={row.name} /></span>}
    <PlayerPositionRank position={row.position} playerId={row.player_id} />
    {row.picked ? <span className="text-[10px] text-muted-foreground">Drafted</span> : null}
    {row.sleeper_injury_status ? <span className="text-amber-600" role="img" aria-label={row.sleeper_injury_status} title={row.sleeper_injury_status}>!</span> : null}
  </div>;
}
