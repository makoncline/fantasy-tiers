"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { PlayerWithPick } from "@/lib/types.draft";
import { slotEligibility, largestContext, scoreGap } from "../_lib/draftTableReview";

const ComparisonContext = createContext<{
  players: PlayerWithPick[];
  toggle: (player: PlayerWithPick) => void;
} | null>(null);

export const useSelectedComparison = () => useContext(ComparisonContext);

export function DraftComparisonProvider({ children }: { children: ReactNode }) {
  const { playersAll } = useDraftData();
  const [selected, setSelected] = useState<PlayerWithPick[]>([]);
  const current = new Map(playersAll.map(player => [player.player_id, player]));
  const players = selected.map(player => current.get(player.player_id) ?? player);
  function toggle(player: PlayerWithPick) {
    setSelected(previous => previous.some(p => p.player_id === player.player_id)
      ? previous.filter(p => p.player_id !== player.player_id)
      : previous.length < 3 ? [...previous, player] : previous);
  }
  return <ComparisonContext.Provider value={{ players, toggle }}>{children}</ComparisonContext.Provider>;
}

export function ComparePlayerButton({ player }: { player: PlayerWithPick }) {
  const comparison = useSelectedComparison();
  if (!comparison) return null;
  const selected = comparison.players.some(p => p.player_id === player.player_id);
  return <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]"
    aria-label={`${selected ? "Remove comparison" : "Compare"} ${player.name}`}
    aria-pressed={selected} disabled={!selected && comparison.players.length >= 3}
    onClick={() => comparison.toggle(player)}>{selected ? "Remove comparison" : "Compare"}</Button>;
}

export function DraftSelectedComparison() {
  const comparison = useSelectedComparison();
  const { userRosterSlots, playersAll } = useDraftData();
  if (!comparison) return null;
  const first = comparison.players[0];
  return <section aria-label="Your comparison" className="space-y-2 rounded-md border p-3 text-xs">
    <p className="font-medium">Your comparison ({comparison.players.length}/3){!first ? " · Select Compare on up to three players." : ""}</p>
    {first ? <>
      <Table>
        <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Status / slot</TableHead><TableHead>Val / Adj</TableHead><TableHead>Difference from {first.name}</TableHead><TableHead>Main context</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{comparison.players.map(player => {
          const current = playersAll.find(p => p.player_id === player.player_id);
          const available = current != null && !current.picked;
          const referenceAvailable = playersAll.some(p => p.player_id === first.player_id && !p.picked);
          return <TableRow key={player.player_id}>
            <TableCell>{player.name} · {player.position}<br />Bye {player.bye_week ?? "unknown"}</TableCell>
            <TableCell>{player.picked ? "Drafted — no longer available" : !current ? "No longer in current pool" : slotEligibility(userRosterSlots, player.position)}</TableCell>
            <TableCell>{available ? `${player.draft_raw_value_score?.toFixed(1) ?? "—"} / ${player.draft_value_score?.toFixed(1) ?? "—"}` : "—"}</TableCell>
            <TableCell>{available && referenceAvailable && player !== first ? `${scoreGap(player.draft_raw_value_score, first.draft_raw_value_score)} Val / ${scoreGap(player.draft_value_score, first.draft_value_score)} Adj` : "—"}</TableCell>
            <TableCell>{available ? largestContext(player) : "Current comparison unavailable"}</TableCell>
            <TableCell><ComparePlayerButton player={player} /></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
      <p>Differences are model estimates, not confidence or projected point gains. Eligibility does not establish starter quality. Preview either player and select the other to inspect the pair.</p>
    </> : null}
  </section>;
}
