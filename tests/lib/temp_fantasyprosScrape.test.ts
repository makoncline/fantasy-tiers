import { describe, it, expect } from "vitest";
import {
  buildWeeklyUrl,
  extractJson,
  fetchHtml,
  parseEcrRows,
  type FantasyProsEcrItem,
  type Position,
  type Scoring,
} from "@/lib/fantasyprosScrape";

describe("temp_fantasypros weekly live fetch", () => {
  it("fetches RB PPR week 2 and parses ecrData", async () => {
    const url = buildWeeklyUrl("PPR", "RB", 2);
    // Log URL being fetched
    console.log("[temp_fantasypros] URL:", url);
    const html = await fetchHtml(url);
    const ecrRaw = extractJson<any>(html, "ecrData");

    expect(ecrRaw).toBeTruthy();
    expect(typeof ecrRaw).toBe("object");

    // Validate and log header fields we observed
    expect(ecrRaw.scoring).toBe("PPR");
    expect(ecrRaw.position_id).toBe("RB");
    expect(String(ecrRaw.week)).toBe("2");
    console.log("[temp_fantasypros] header:", {
      scoring: ecrRaw.scoring,
      position_id: ecrRaw.position_id,
      week: ecrRaw.week,
      total_experts: ecrRaw.total_experts,
      count: ecrRaw.count,
      last_updated: ecrRaw.last_updated,
    });

    // players array exists and has reasonable length
    const players: FantasyProsEcrItem[] = Array.isArray(ecrRaw)
      ? (ecrRaw as FantasyProsEcrItem[])
      : Array.isArray(ecrRaw.players)
      ? (ecrRaw.players as FantasyProsEcrItem[])
      : [];
    expect(Array.isArray(players)).toBe(true);
    expect(players.length).toBeGreaterThan(20);
    console.log("[temp_fantasypros] players length:", players.length);

    // Parse rows and check a couple of fields are normalized
    const rows = parseEcrRows(players);
    expect(rows.length).toBeGreaterThan(20);
    expect(rows[0]).toHaveProperty("player_id");
    expect(rows[0]).toHaveProperty("rank_ecr");
    console.log(
      "[temp_fantasypros] first 5 rows (selected fields):",
      rows.slice(0, 5).map((r) => ({
        id: r.player_id,
        name: r.player_name,
        pos: r.player_positions,
        bye: r.player_bye_week,
        ecr: r.rank_ecr,
        page: r.player_page_url,
        grade: r.start_sit_grade,
      }))
    );
  }, 30000);

  const cases: Array<{ position: Position; scoring: Scoring }> = [
    { position: "WR", scoring: "PPR" },
    { position: "TE", scoring: "PPR" },
    { position: "FLEX", scoring: "PPR" },
    { position: "QB", scoring: "STD" },
    { position: "K", scoring: "STD" },
    { position: "DST", scoring: "STD" },
  ];

  for (const c of cases) {
    it(`fetches ${c.position} ${c.scoring} week 2 and logs`, async () => {
      const url = buildWeeklyUrl(c.scoring, c.position, 2);
      console.log("[temp_fantasypros] URL:", url);
      const html = await fetchHtml(url);
      const ecrRaw = extractJson<any>(html, "ecrData");
      expect(ecrRaw).toBeTruthy();
      const expectedPosId = c.position === "FLEX" ? "FLX" : c.position;
      expect(ecrRaw.position_id).toBe(expectedPosId);
      if (c.position === "QB" || c.position === "K" || c.position === "DST") {
        expect(ecrRaw.scoring).toBe("STD");
      } else {
        expect(ecrRaw.scoring).toBe(c.scoring);
      }
      const players: FantasyProsEcrItem[] = Array.isArray(ecrRaw)
        ? (ecrRaw as FantasyProsEcrItem[])
        : Array.isArray(ecrRaw.players)
        ? (ecrRaw.players as FantasyProsEcrItem[])
        : [];
      console.log("[temp_fantasypros] header:", {
        scoring: ecrRaw.scoring,
        position_id: ecrRaw.position_id,
        week: ecrRaw.week,
        total_experts: ecrRaw.total_experts,
        count: ecrRaw.count,
      });
      console.log("[temp_fantasypros] players length:", players.length);
      const rows = parseEcrRows(players);
      console.log(
        "[temp_fantasypros] first 3 rows (selected fields):",
        rows.slice(0, 3).map((r) => ({
          id: r.player_id,
          name: r.player_name,
          pos: r.player_positions,
          bye: r.player_bye_week,
          ecr: r.rank_ecr,
          page: r.player_page_url,
          grade: r.start_sit_grade,
        }))
      );
      expect(rows.length).toBeGreaterThan(5);
    }, 30000);
  }
});
