import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ProjectionSourceSchema, type ProjectionSource } from "./draftSourceComparison";
import type { DraftProjectionStats } from "./beerPlusStrategy";

const RawSchema = z.object({ meta: z.object({ source: z.literal("FantasyPros"), position: z.string(), week: z.literal("draft"), date: z.string(), rowCount: z.number() }), rows: z.array(z.record(z.string(), z.string())) });
const fields = { pass_yd: "PASSING_YDS", pass_td: "PASSING_TDS", pass_int: "INTS", rush_yd: "RUSHING_YDS", rush_td: "RUSHING_TDS", rec: "REC", rec_yd: "RECEIVING_YDS", rec_td: "RECEIVING_TDS", fum_lost: "FL" } as const;
const minimum = { QB: 30, RB: 60, WR: 80, TE: 30 };
export function loadFantasyProsProjectionSource(directory = path.resolve("public/data/fantasypros/raw")): ProjectionSource {
  const rows: ProjectionSource["rows"] = [], dates: string[] = [], problems: string[] = [];
  for (const position of ["QB", "RB", "WR", "TE"] as const) {
    try {
      const raw = RawSchema.parse(JSON.parse(fs.readFileSync(path.join(directory, `${position}-half-draft_raw.json`), "utf8")));
      if (raw.meta.position !== position || raw.rows.length !== raw.meta.rowCount || raw.rows.length < minimum[position]) throw new Error("Incomplete table");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.meta.date)) throw new Error("Missing source date");
      dates.push(raw.meta.date);
      const before = rows.length;
      for (const row of raw.rows) {
        if (!row.Player) continue;
        const stats: DraftProjectionStats = {};
        let valid = true;
        for (const [stat, column] of Object.entries(fields)) {
          // FP does not project secondary passing for skill players or rushing for TEs.
          const omitted = (position !== "QB" && stat.startsWith("pass_")) || (position === "QB" && stat.startsWith("rec")) || (position === "TE" && stat.startsWith("rush_"));
          if (omitted) continue;
          const key = position === "TE" && stat === "rec_yd" ? "YDS" : position === "TE" && stat === "rec_td" ? "TDS" : column;
          const text = row[`${key}_AVG`]?.replaceAll(",", "").trim();
          const value = text ? Number(text) : NaN;
          if (!Number.isFinite(value)) { valid = false; break; }
          Object.assign(stats, { [stat]: value });
        }
        if (valid) rows.push({ name: row.Player, position, stats });
      }
      const validRows = rows.slice(before);
      if (validRows.length < minimum[position] || validRows.length !== raw.rows.length || new Set(validRows.map(r => r.name)).size !== validRows.length) throw new Error("Invalid or duplicate stats");
    } catch { problems.push(`FP ${position} projections are missing or incomplete.`); }
  }
  return ProjectionSourceSchema.parse({ rows, problems, updatedAt: dates.sort()[0] ?? null });
}

export function readPublishedFantasyProsProjections(): ProjectionSource {
  try {
    return ProjectionSourceSchema.parse(JSON.parse(fs.readFileSync(path.resolve("public/data/aggregate/fantasypros-draft-projections.json"), "utf8")));
  } catch {
    return { rows: [], updatedAt: null, problems: ["FP projections are unavailable or invalid."] };
  }
}
