// src/components/AvailablePlayers.tsx

import type { RankedPlayer } from "@/lib/schemas";
import { PlayerTable, mapToPlayerRow } from "./PlayerTable";

interface AvailablePlayersProps {
  availablePlayers: RankedPlayer[];
  loading: boolean;
}

export default function AvailablePlayers({
  availablePlayers,
  loading,
}: AvailablePlayersProps) {
  if (loading) return <p aria-live="polite">Loading available players...</p>;
  return <PlayerTable rows={mapToPlayerRow(availablePlayers)} />;
}
