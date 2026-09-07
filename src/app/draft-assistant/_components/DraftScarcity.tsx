"use client";
import { useDraftData } from "../_contexts/DraftDataContext";
import type { Position } from "@/lib/schemas";

export function remainingPositionValue(rows: readonly { value: number | null | undefined; drafted: boolean }[]) {
  let total = 0;
  let remaining = 0;
  for (const row of rows) {
    if (row.value == null || !Number.isFinite(row.value) || row.value <= 0) continue;
    total += row.value;
    if (!row.drafted) remaining += row.value;
  }
  return total > 0 ? 100 * remaining / total : null;
}

export function DraftScarcity({ position }: { position: Position | "FLEX" }) {
  const { playersByPosition, sourceComparison, valueSource } = useDraftData();
  const values = valueSource === "fp" ? sourceComparison?.fp?.values : sourceComparison?.sleeper.values;
  const rows = playersByPosition?.[position] ?? [];
  const percent = remainingPositionValue(rows.map(row => ({
    value: values?.valuesByPlayerId[row.player_id]?.value,
    drafted: Boolean(row.picked),
  })));
  return <span className="font-medium tabular-nums" title="Position scarcity: undrafted positive Val divided by all positive Val in this position pool, using the selected projection source. Lower means less value remains. This is not a player survival probability.">Value left {percent == null ? "—" : percent > 0 && percent < 1 ? "<1%" : `${Math.round(percent)}%`}</span>;
}
