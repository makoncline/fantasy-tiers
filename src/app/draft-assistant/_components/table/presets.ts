import type { PlayerWithPick } from "@/lib/types.draft";
import type { ColumnDef, ColumnGroup } from "./columns";
import { fmt } from "@/lib/formatters";

const col = <K extends keyof PlayerWithPick>(
  id: string,
  key: K,
  opts: Partial<ColumnDef<PlayerWithPick>> = {}
): ColumnDef<PlayerWithPick> => ({
  id,
  header: id.toUpperCase(),
  accessor: (r) => r[key] as number | string | null | undefined,
  sortAs: "number",
  nulls: "last",
  ...opts,
});

function positionRank(row: PlayerWithPick) {
  return typeof row.fp_rank_pos === "number" && row.position
    ? `${String(row.position).toUpperCase()}${row.fp_rank_pos}`
    : "—";
}

function nameWithPositionRank(name: unknown, row: PlayerWithPick) {
  const rank = positionRank(row);
  const suffix = rank === "—" ? row.position : rank;
  return `${name} (${suffix})`;
}

function formatAdpWithDelta(row: PlayerWithPick) {
  const adp = row.sleeper_adp_round_pick ?? "—";
  if (
    typeof row.draft_adp_delta_rounds !== "number" ||
    Math.abs(row.draft_adp_delta_rounds) < 0.5
  ) {
    return adp;
  }

  const rounded = Number(row.draft_adp_delta_rounds.toFixed(1));
  const delta = `${rounded > 0 ? "+" : ""}${rounded}`;
  return `${adp} (${delta})`;
}

function formatOverallWithSleeperDelta(row: PlayerWithPick) {
  const fpRank = row.fp_rank_ave;
  if (typeof fpRank !== "number") return "—";
  const formattedFpRank = fpRank % 1 === 0 ? String(fpRank) : fpRank.toFixed(1);
  if (typeof row.sleeper_rank_overall !== "number") return formattedFpRank;

  const delta = row.sleeper_rank_overall - fpRank;
  const formattedDelta = delta % 1 === 0 ? String(delta) : delta.toFixed(1);
  return `${formattedFpRank} (${delta > 0 ? "+" : ""}${formattedDelta})`;
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
    header: "Player",
    children: [
      {
        id: "name",
        header: "Name",
        accessor: (r) => r.name,
        sortAs: "string",
        width: "18ch",
        render: (name, r) => nameWithPositionRank(name, r),
      },
      {
        id: "ovr",
        header: "ECR (Sleeper Δ)",
        description:
          "FantasyPros ECR average, with Sleeper overall rank delta in parentheses.",
        accessor: (r) => r.fp_rank_ave ?? null,
        sortable: true,
        sortAs: "number",
        width: "9ch",
        render: (_, r) => formatOverallWithSleeperDelta(r),
      },
      {
        id: "tm_bw",
        header: "Team / Bye",
        accessor: (r) => fmt.teamBye(r),
        sortable: true,
        sortAs: "string",
        width: "7ch",
      },
      {
        id: "tier_level",
        header: "Tier (overall / pos)",
        description:
          "FantasyPros overall tier / FantasyPros position tier.",
        accessor: (r) => r.tier_level ?? r.fp_tier ?? r.tier ?? null,
        sortAs: "number",
        sortable: true,
        width: "8ch",
        render: (_, r) => formatOverallAndPositionTier(r),
      },
    ],
  },
  {
    header: "Pick",
    children: [
      {
        id: "val",
        header: "VAL",
        description:
          "Canonical pick value score from FantasyPros ECR, roster fit, timing, ADP, and draft strategy.",
        accessor: (r) => r.draft_value_score ?? null,
        sortable: true,
        heat: { scale: "val" },
        defaultDir: "desc",
        sortAs: "number",
        width: "6ch",
      },
      {
        id: "adp",
        header: "ADP (delta)",
        description:
          "Sleeper ADP round/pick. Delta only appears at 0.5+ rounds: +N means the player might be drafted later, -N means the player might go earlier.",
        accessor: (r) => r.sleeper_adp ?? null,
        sortable: true,
        sortAs: "number",
        width: "12ch",
        render: (_, r) => formatAdpWithDelta(r),
      },
    ],
  },
];

export const GROUPS_COMPACT_FULL: ColumnGroup<PlayerWithPick>[] = [
  {
    header: "Player",
    children: GROUPS_FULL[0]?.children ?? [],
  },
  {
    header: "Pick",
    children: GROUPS_FULL[1]?.children ?? [],
  },
];

export const GROUPS_COMPACT_NAMEONLY: ColumnGroup<PlayerWithPick>[] = [
  {
    header: " ",
    children: [
      col("tier_rnk", "tier_rank", { header: "RNK", width: "4ch" }),
      {
        id: "name",
        header: "Name",
        accessor: (r) => r.name,
        sortable: true,
        sortAs: "string",
        width: "16ch",
        render: (name, r) => nameWithPositionRank(name, r),
      },
    ],
  },
];
