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
          <TableHead>Team</TableHead>
          <TableHead>Pos</TableHead>
          <TableHead>Bye</TableHead>
          <TableHead>Weeks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {slots.map((s, idx) => {
          const p = s.player;
          const byeWeek = p?.bye_week ? Number(p.bye_week) : null;
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
                {p ? <span data-drafted="D">{p.name}</span> : "—"}
              </TableCell>
              <TableCell
                className={highlight ? "border-primary border-y-2" : undefined}
              >
                {p?.team ?? "—"}
              </TableCell>
              <TableCell
                className={highlight ? "border-primary border-y-2" : undefined}
              >
                {p?.position ?? "—"}
              </TableCell>
              <TableCell
                className={highlight ? "border-primary border-y-2" : undefined}
              >
                {p?.bye_week ?? "—"}
              </TableCell>
              <TableCell
                className={`align-middle ${
                  highlight
                    ? "border-primary border-y-2 border-r-2 rounded-r-md"
                    : ""
                }`}
              >
                <div className="flex h-6 items-stretch gap-0.5">
                  {Array.from({ length: 18 }, (_, i) => {
                    const week = i + 1;
                    const isBye = byeWeek === week;
                    return (
                      <div
                        key={week}
                        className={`${
                          isBye ? "bg-red-500" : "bg-muted"
                        } w-1 rounded`}
                        title={`Week ${week}${isBye ? " (bye)" : ""}`}
                        aria-label={`Week ${week}${isBye ? " bye" : ""}`}
                      />
                    );
                  })}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
