import { canAddPositionToRoster } from "@/lib/draftRosterPolicy";
import type { RosterSlot, Position } from "@/lib/schemas";
import type { PlayerWithPick } from "@/lib/types.draft";

export const DRAFT_BOARD_POSITIONS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "DEF",
  "K",
] as const satisfies readonly Position[];

export const OVERALL_PLAYER_LIMIT = 50;
export const POSITION_PLAYER_LIMIT = 10;

type MarketComparisonRow = Pick<PlayerWithPick, "fp_rank_ave" | "sleeper_adp">;
type ComebackRow = Pick<
  PlayerWithPick,
  "draft_comeback_label" | "draft_comeback_probability"
>;

export function hasDraftEcr(row: PlayerWithPick) {
  return typeof row.fp_rank_ave === "number" && Number.isFinite(row.fp_rank_ave);
}

export function isRosterLegalPlayer(
  row: PlayerWithPick,
  counts: Partial<Record<Position, number>>,
  requirements: Partial<Record<RosterSlot, number>>
) {
  return isRosterLegalPosition(row.position, counts, requirements);
}

export function isRosterLegalPosition(
  position: Position,
  counts: Partial<Record<Position, number>>,
  requirements: Partial<Record<RosterSlot, number>>
) {
  return canAddPositionToRoster({
    position,
    counts,
    requirements,
  });
}

export function draftBoardRows(input: {
  rows: readonly PlayerWithPick[];
  diagnostics: boolean;
  counts: Partial<Record<Position, number>>;
  requirements: Partial<Record<RosterSlot, number>>;
}) {
  if (input.diagnostics) {
    return input.rows.filter((row) => row.picked || !hasDraftEcr(row));
  }

  return input.rows.filter(
    (row) =>
      !row.picked &&
      hasDraftEcr(row) &&
      isRosterLegalPlayer(row, input.counts, input.requirements)
  );
}

export function sleeperEcrEdge(row: MarketComparisonRow) {
  const ecr = row.fp_rank_ave;
  if (typeof ecr !== "number" || !Number.isFinite(ecr)) return null;
  if (
    typeof row.sleeper_adp !== "number" ||
    !Number.isFinite(row.sleeper_adp)
  ) {
    return null;
  }
  return row.sleeper_adp - ecr;
}

export function formatSleeperEcrEdge(row: MarketComparisonRow) {
  const edge = sleeperEcrEdge(row);
  if (edge == null) return "—";
  if (Math.abs(edge) < 0.5) return "Same";
  const picks = Math.abs(edge).toFixed(Math.abs(edge) >= 10 ? 0 : 1);
  return edge > 0 ? `+${picks} later` : `-${picks} earlier`;
}

export function formatComeback(row: ComebackRow) {
  if (!row.draft_comeback_label || row.draft_comeback_label === "unknown") {
    return "—";
  }
  const label =
    row.draft_comeback_label === "toss-up"
      ? "Toss-up"
      : `${row.draft_comeback_label[0]?.toUpperCase() ?? ""}${row.draft_comeback_label.slice(1)}`;
  return typeof row.draft_comeback_probability === "number"
    ? `${label} ${Math.round(row.draft_comeback_probability * 100)}%`
    : label;
}
