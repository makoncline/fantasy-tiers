import type { PlayerRow } from "@/lib/playerRows";

export const fmt = {
  empty: (v: number | string | null | undefined) =>
    v == null || v === "" ? "—" : v,
  percent0: (v: number | string | null | undefined) =>
    v == null ? "—" : `${Math.round(Number(v))}%`,
  teamBye: (r: PlayerRow) =>
    r.team || r.bye_week
      ? `${r.team ?? ""}${r.bye_week ? `/${r.bye_week}` : ""}`
      : "—",
};
