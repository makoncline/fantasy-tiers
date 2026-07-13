import React from "react";
import type { DraftedPlayer, RosterSlot } from "@/lib/schemas";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function RosterSlots({
  slots,
  highlightPlayerId,
}: {
  slots: { slot: RosterSlot; player: DraftedPlayer | null }[];
  highlightPlayerId?: string;
}) {
  return (
    <Table data-testid="roster-table">
      <TableHeader>
        <TableRow>
          <TableHead>Slot</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Bye</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slots.map((s, idx) => {
          const p = s.player;
          const highlight =
            p && highlightPlayerId && p.player_id === highlightPlayerId;
          return (
            <TableRow key={`${s.slot}-${idx}`} className="h-10">
              <TableCell
                className={
                  highlight
                    ? "border-primary border-y-2 border-l-2 rounded-l-md"
                    : undefined
                }
              >
                {s.slot}
              </TableCell>
              <TableCell
                className={highlight ? "border-primary border-y-2" : undefined}
              >
                {p ? (
                  <div data-drafted="D">
                    <div>{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.team ?? "—"} · {p.position ?? "—"}
                    </div>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell
                className={
                  highlight
                    ? "border-primary border-y-2 border-r-2 rounded-r-md"
                    : undefined
                }
              >
                {p?.bye_week ?? "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
