import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { z } from "zod";

export type PlayerRow = {
  player_id: string;
  name: string;
  position: string;
  rank?: number | string;
  tier?: number | string;
  team?: string;
  bye_week?: number | string;
};

export function PlayerTable({
  rows,
  renderActions,
}: {
  rows: PlayerRow[];
  renderActions?: (row: PlayerRow) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Rank</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Bye Week</TableHead>
          {renderActions ? <TableHead className="w-10" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p, idx) => (
          <TableRow key={`${p.player_id || p.name || "row"}-${idx}`}>
            <TableCell>{p.name}</TableCell>
            <TableCell>{p.position}</TableCell>
            <TableCell>{p.rank ?? "—"}</TableCell>
            <TableCell>{p.tier ?? "—"}</TableCell>
            <TableCell>{p.team ?? "—"}</TableCell>
            <TableCell>{p.bye_week ?? "—"}</TableCell>
            {renderActions ? <TableCell>{renderActions(p)}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Coerce arbitrary player-like records (RankedPlayer / DraftedPlayer) into PlayerRow
const PlayerLikeSchema = z.object({
  player_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  position: z.string().optional(),
  pos: z.string().optional(),
  rank: z.union([z.number(), z.string()]).optional(),
  tier: z.union([z.number(), z.string()]).optional(),
  team: z.string().optional(),
  pro_team: z.string().optional(),
  nfl_team: z.string().optional(),
  bye_week: z.union([z.number(), z.string()]).optional(),
  bye: z.union([z.number(), z.string()]).optional(),
  player: z
    .object({
      id: z.string().optional(),
      full_name: z.string().optional(),
      position: z.string().optional(),
      rank: z.union([z.number(), z.string()]).optional(),
      tier: z.union([z.number(), z.string()]).optional(),
      team: z.string().optional(),
      bye_week: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

export function mapToPlayerRow(anyPlayers: unknown[]): PlayerRow[] {
  const arr = (Array.isArray(anyPlayers) ? anyPlayers : []).flatMap((p) => {
    const res = PlayerLikeSchema.safeParse(p);
    return res.success ? [res.data] : [];
  });
  return arr.map((p) => {
    const nested = p.player ?? {};
    const name =
      p.name ??
      p.full_name ??
      nested.full_name ??
      (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : "—");
    return {
      player_id: p.player_id ?? p.id ?? String(nested.id ?? ""),
      name,
      position: p.position ?? p.pos ?? nested.position ?? "—",
      rank: p.rank ?? nested.rank,
      tier: p.tier ?? nested.tier,
      team: p.team ?? p.pro_team ?? p.nfl_team ?? nested.team ?? "—",
      bye_week: p.bye_week ?? p.bye ?? nested.bye_week ?? "—",
    };
  });
}
