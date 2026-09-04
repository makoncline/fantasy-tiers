import { createElement } from "react";
import {
  formatComeback,
  formatSleeperEcrEdge,
  sleeperEcrEdge,
} from "@/app/draft-assistant/_lib/draftBoardDisplay";
import type { PlayerWithPick } from "@/lib/types.draft";
import type { ColumnGroup } from "./columns";
import { PlayerSummaryCell } from "./PlayerSummaryCell";

export const DRAFT_VALUE_DESCRIPTIONS = {
  raw:
    "Starter-aware value for this league's scoring and lineup. It does not use your roster or current draft state.",
  adjusted:
    "VAL adjusted for your roster, pick timing, league demand, and current draft state.",
} as const;

export function formatDraftValue(value: number | string | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(1))
    : "—";
}

function formatOverallAndPositionTier(row: PlayerWithPick) {
  const overallTier = row.tier_level ?? row.fp_tier ?? row.tier;
  const positionTier = row.position_tier_level;
  if (typeof overallTier !== "number" && typeof positionTier !== "number") {
    return "—";
  }
  return `${overallTier ?? "—"}/${positionTier ?? "—"}`;
}

export const GROUPS_FULL: ColumnGroup<PlayerWithPick>[] = [
  {
    header: "Draft board",
    children: [
      {
        id: "name",
        header: "Player",
        accessor: (r) => r.name,
        sortAs: "string",
        width: "22ch",
        render: (_, row) => createElement(PlayerSummaryCell, { row }),
      },
      {
        id: "tier_level",
        header: "Tier",
        description: "FantasyPros overall tier / position tier.",
        accessor: (r) => r.tier_level ?? r.fp_tier ?? r.tier ?? null,
        sortable: true,
        sortAs: "number",
        width: "6ch",
        render: (_, row) => formatOverallAndPositionTier(row),
      },
      {
        id: "raw",
        header: "VAL",
        description: DRAFT_VALUE_DESCRIPTIONS.raw,
        accessor: (r) => r.draft_raw_value_score ?? null,
        sortable: true,
        defaultDir: "desc",
        sortAs: "number",
        width: "6ch",
        render: formatDraftValue,
      },
      {
        id: "adj",
        header: "ADJ",
        description: DRAFT_VALUE_DESCRIPTIONS.adjusted,
        accessor: (r) => r.draft_value_score ?? null,
        sortable: true,
        heat: { scale: "val" },
        defaultDir: "desc",
        sortAs: "number",
        width: "6ch",
        render: formatDraftValue,
      },
      {
        id: "ecr",
        header: "ECR",
        description: "FantasyPros expert consensus rank.",
        accessor: (r) => r.fp_rank_ave ?? null,
        sortable: true,
        sortAs: "number",
        width: "6ch",
        render: formatDraftValue,
      },
      {
        id: "sleeper_adp",
        header: "Sleeper ADP",
        description: "Sleeper average draft position as round.pick.",
        accessor: (r) => r.sleeper_adp ?? null,
        sortable: true,
        sortAs: "number",
        nulls: "last",
        width: "9ch",
        render: (_, row) => row.sleeper_adp_round_pick ?? "—",
      },
      {
        id: "market_edge",
        header: "Sleeper vs ECR",
        description:
          "Sleeper ADP minus FantasyPros ECR. Later means Sleeper drafters may wait longer than expert consensus.",
        accessor: sleeperEcrEdge,
        sortable: true,
        sortAs: "number",
        nulls: "last",
        width: "11ch",
        render: (_, row) => formatSleeperEcrEdge(row),
      },
      {
        id: "back",
        header: "Back?",
        description: "Chance that the player is available at your next pick.",
        accessor: (row) => row.draft_comeback_probability ?? null,
        sortable: true,
        sortAs: "number",
        nulls: "last",
        width: "10ch",
        render: (_, row) => formatComeback(row),
      },
    ],
  },
];
