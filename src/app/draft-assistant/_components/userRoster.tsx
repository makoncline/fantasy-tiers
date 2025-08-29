import type { DraftedPlayer } from "@/lib/schemas";
import { PlayerTable, mapToPlayerRow } from "./PlayerTable";

interface UserRosterProps {
  players: DraftedPlayer[];
}

export default function UserRoster({ players }: UserRosterProps) {
  if (players.length === 0) {
    return <p>You haven&apos;t drafted any players yet.</p>;
  }

  return <PlayerTable rows={mapToPlayerRow(players)} />;
}
