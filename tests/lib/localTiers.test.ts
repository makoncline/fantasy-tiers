import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildTierRows } from "../../scripts/tiers/generate-local-tiers";

const fixtures = z.array(z.object({
  position: z.enum(["QB", "RB", "WR", "TE", "K", "DEF", "FLEX", "ALL"]),
  scoring: z.enum(["std", "half", "ppr"]),
  input: z.array(z.object({ player_name: z.string(), player_positions: z.string(), rank_ecr: z.number(), rank_ave: z.number() })),
  expected: z.array(z.number()),
})).parse(JSON.parse(fs.readFileSync("tests/fixtures/tiers/boris-20260908.json", "utf8")));

describe("Boris tier generation", () => {
  it("matches the independent R experiment across all 13 tables and preserves CSV fields", () => {
    for (const fixture of fixtures) {
      const rows = buildTierRows(fixture.input, { outputPosition: fixture.position, scoring: fixture.scoring });
      expect(rows.map(row => row.Tier), `${fixture.position}/${fixture.scoring}`).toEqual(fixture.expected);
      expect(rows.map(row => [row.Rank, row["Player.Name"], row["Avg.Rank"]])).toEqual(
        fixture.input.map((row, i) => [i + 1, row.player_name, row.rank_ave])
      );
    }
  }, 30_000);

  it("excludes QB and kicker rows from FLEX and rejects missing average ranks", () => {
    const fixture = fixtures.find(f => f.position === "FLEX" && f.scoring === "ppr")!;
    const rows = buildTierRows([
      { player_name: "Quarterback", player_positions: "QB", rank_ecr: 1, rank_ave: 1 },
      { player_name: "Kicker", player_positions: "K", rank_ecr: 2, rank_ave: 2 },
      ...fixture.input,
    ], { outputPosition: "FLEX", scoring: "ppr" });
    expect(rows.map(row => row["Player.Name"])).toEqual(fixture.input.map(row => row.player_name));
    expect(() => buildTierRows([{ player_name: "Missing rank", player_positions: "WR", rank_ecr: 1 }], {
      outputPosition: "WR", scoring: "ppr",
    })).toThrow("Missing FantasyPros Avg.Rank");
  });
});
