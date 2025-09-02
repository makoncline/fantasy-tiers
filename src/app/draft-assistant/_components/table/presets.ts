import type { PlayerWithPick } from "@/lib/types.draft";
import type { ColumnDef, ColumnGroup } from "./columns";
import { fmt } from "@/lib/formatters";
import { SEASON_WEEKS } from "@/lib/constants";

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

export const GROUPS_FULL: ColumnGroup<PlayerWithPick>[] = [
  {
    header: "Player",
    children: [
      {
        id: "name",
        header: "Name",
        accessor: (r) => r.name,
        sortAs: "string",
        width: "16ch",
      },
      {
        id: "tm_bw",
        header: "TM/BW",
        accessor: (r) => fmt.teamBye(r),
        sortAs: "string",
        width: "7ch",
      },
    ],
  },
  {
    header: "Boris Chen",
    children: [
      col("bc_rnk", "bc_rank", { header: "RNK", sortable: true, width: "4ch" }),
      {
        id: "bc_tier",
        header: "RT",
        accessor: (r) => r.bc_tier ?? r.tier,
        sortAs: "number",
        width: "3ch",
      },
    ],
  },
  {
    header: "Sleeper",
    children: [
      col("sl_rnk", "sleeper_rank_overall", { header: "RNK", sortable: true }),
      col("sl_adp", "sleeper_adp", { header: "ADP", sortable: true }),
      col("sl_pts", "sleeper_pts", { header: "PTS", sortable: true }),
    ],
  },
  {
    header: "FantasyPros",
    children: [
      {
        id: "fp_tier",
        header: "RT",
        accessor: (r) => r.fp_tier,
        sortAs: "number",
      },
      {
        id: "ecr",
        header: "ECR",
        accessor: (r) => {
          const s = r.ecr_round_pick;
          if (!s) return null;
          const parts = s.split(".").map(Number);
          if (parts.length !== 2) return null;
          const rd = parts[0];
          const pk = parts[1];
          if (rd == null || pk == null) return null;
          return Number.isFinite(rd) && Number.isFinite(pk)
            ? rd * 100 + pk
            : null;
        },
        sortable: true,
        sortAs: "number",
        render: (_, r) => r.ecr_round_pick ?? "—",
      },
      {
        id: "prnk",
        header: "PRNK",
        accessor: (r) =>
          typeof r.fp_rank_pos === "number" && r.position
            ? `${String(r.position).toUpperCase()}${r.fp_rank_pos}`
            : "—",
        sortAs: "string",
      },
      col("fp_pts", "fp_pts", { header: "PTS", sortable: true }),
      {
        id: "owned",
        header: "%OWN",
        accessor: (r) =>
          r.fp_player_owned_avg != null
            ? Math.round(r.fp_player_owned_avg)
            : null,
        sortable: true,
        render: (v) => fmt.percent0(v),
        defaultDir: "desc",
      },
    ],
  },
  {
    header: "Calc",
    children: [
      {
        id: "val",
        header: "VAL",
        accessor: (r) => r.fp_value ?? r.val ?? null,
        sortable: true,
        heat: { scale: "val" },
        defaultDir: "desc",
      },
      {
        id: "ps",
        header: "PS",
        accessor: (r) => {
          const raw =
            typeof r.fp_positional_scarcity_slope === "number"
              ? r.fp_positional_scarcity_slope
              : typeof r.ps === "number"
              ? r.ps
              : null;
          return raw != null && raw > 0 ? Math.round(raw) : null; // null => excluded from heat range
        },
        sortable: true,
        heat: { scale: "ps" },
        render: (v) =>
          v != null && typeof v === "number" && v > 0 ? `${v}%` : "-",
        defaultDir: "desc",
      },
      {
        id: "md",
        header: "MD",
        accessor: (r) =>
          typeof r.market_delta === "number" ? r.market_delta : null,
        sortable: true,
        heat: { scale: "md" },
        defaultDir: "desc",
      },
      {
        id: "ppg",
        header: "PPG",
        accessor: (r) =>
          typeof r.fp_pts === "number"
            ? +(r.fp_pts / SEASON_WEEKS).toFixed(1)
            : null,
        sortable: true,
        sortAs: "number",
        defaultDir: "desc",
      },
      {
        id: "pck",
        header: "PCK",
        accessor: (r) => r.picked?.overall ?? null,
        sortable: true,
        sortAs: "number",
        defaultDir: "asc", // lowest overall = earlier pick
      },
    ],
  },
];

export const GROUPS_COMPACT_FULL: ColumnGroup<PlayerWithPick>[] = [
  {
    header: " ",
    children: [
      col("bc_rnk", "bc_rank", { header: "RNK", width: "4ch", sortable: true }),
      {
        id: "name",
        header: "Name",
        accessor: (r) => r.name,
        sortAs: "string",
        width: "16ch",
      },
      {
        id: "tm_bw",
        header: "TM/BW",
        accessor: (r) => fmt.teamBye(r),
        sortAs: "string",
        width: "7ch",
      },
      {
        id: "ecr",
        header: "ECR",
        accessor: (r) => {
          const s = r.ecr_round_pick;
          if (!s) return null;
          const parts = s.split(".").map(Number);
          if (parts.length !== 2) return null;
          const rd = parts[0];
          const pk = parts[1];
          if (rd == null || pk == null) return null;
          return Number.isFinite(rd) && Number.isFinite(pk)
            ? rd * 100 + pk
            : null;
        },
        sortable: true,
        sortAs: "number",
        width: "5ch",
        render: (_, r) => r.ecr_round_pick ?? "—",
      },
      {
        id: "rt",
        header: "RT",
        accessor: (r) => r.fp_tier ?? "—",
        sortAs: "number",
        width: "3ch",
      },
      {
        id: "val",
        header: "VAL",
        accessor: (r) => r.fp_value ?? r.val ?? null,
        sortable: true,
        heat: { scale: "val" },
        width: "5ch",
      },
      {
        id: "ps",
        header: "PS",
        accessor: (r) => {
          const raw =
            typeof r.fp_positional_scarcity_slope === "number"
              ? r.fp_positional_scarcity_slope
              : typeof r.ps === "number"
              ? r.ps
              : null;
          return raw != null && raw > 0 ? Math.round(raw) : null; // null => excluded from heat range
        },
        sortable: true,
        heat: { scale: "ps" },
        width: "5ch",
        render: (v) =>
          v != null && typeof v === "number" && v > 0 ? `${v}%` : "-",
      },
    ],
  },
];

export const GROUPS_COMPACT_NAMEONLY: ColumnGroup<PlayerWithPick>[] = [
  {
    header: " ",
    children: [
      col("bc_rnk", "bc_rank", { header: "RNK", width: "4ch" }),
      {
        id: "name",
        header: "Name",
        accessor: (r) => r.name,
        sortAs: "string",
        width: "16ch",
      },
    ],
  },
];
