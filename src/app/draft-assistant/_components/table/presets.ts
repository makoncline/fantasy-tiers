import { createElement } from "react";
import type { PlayerWithPick } from "@/lib/types.draft";
import type { ColumnGroup } from "./columns";
import { PlayerSummaryCell } from "./PlayerSummaryCell";
import { DraftEcrValue } from "../DraftEcrValue";
import { DraftAdpCell } from "./DraftAdpCell";

export const DRAFT_VALUE_DESCRIPTIONS = {
  raw: "Starter-aware value for this league's scoring and lineup. It does not use your roster or current draft state.",
  adjusted: "VAL adjusted for your roster, pick timing, league demand, and current draft state.",
} as const;

export function formatDraftValue(value: number | string | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(1)) : "—";
}

export function draftTableGroups({ source = "sleeper", position = "Overall", onOpen }: {
  source?: string | undefined;
  position?: string;
  onOpen?: ((row: PlayerWithPick) => void) | undefined;
} = {}): ColumnGroup<PlayerWithPick>[] {
  const overall = position === "Overall";
  const tierLabel = position === "FLEX" ? "FLEX" : position === "DEF" ? "D/ST" : position;
  return [{ header: "Draft board", children: [
    { id: overall ? "tier_level" : "position_tier", header: `FP Tier (${tierLabel})`,
      description: `FantasyPros ${tierLabel} tier.`,
      accessor: row => overall || position === "FLEX" ? row.tier_level ?? null : row.position_tier_level ?? null,
      sortable: true, sortAs: "number", width: "8ch", render: value => value ?? "—" },
    { id: "name", header: "Player", accessor: row => row.name, sortable: true, sortAs: "string", className: "min-w-56",
      render: (_, row) => createElement(PlayerSummaryCell, { row, onOpen }) },
    { id: "team_bye", header: "TM/BYE", accessor: row => `${row.team ?? "FA"}/${row.bye_week ?? "—"}`,
      sortAs: "string", width: "8ch" },
    { id: "points", header: "PTS", description: "Selected source season projection under league scoring.",
      accessor: row => row.draft_projected_points ?? null, sortable: true, defaultDir: "desc", sortAs: "number", width: "6ch", render: formatDraftValue },
    { id: "raw", header: "VAL", description: DRAFT_VALUE_DESCRIPTIONS.raw,
      accessor: row => row.draft_raw_value_score ?? null, sortable: true, defaultDir: "desc", sortAs: "number", width: "6ch", render: formatDraftValue },
    { id: "adj", header: "ADJ", description: DRAFT_VALUE_DESCRIPTIONS.adjusted,
      accessor: row => row.draft_value_score ?? null, sortable: true, defaultDir: "desc", sortAs: "number", heat: { scale: "val" }, width: "6ch", render: formatDraftValue },
    { id: "market", header: source === "fp" ? "ECR" : "ADP", description: source === "fp" ? "FantasyPros consensus rank as round.pick." : "Platform average draft position as round.pick.",
      accessor: row => source === "fp" ? row.fp_rank_ave ?? null : row.sleeper_adp ?? null,
      sortable: true, sortAs: "number", width: "7ch",
      render: (_, row) => source === "fp" ? createElement(DraftEcrValue, { rank: row.fp_rank_ave }) : createElement(DraftAdpCell, { playerId: row.player_id, adp: row.sleeper_adp ?? null, display: row.sleeper_adp_round_pick }) },
  ] }];
}
