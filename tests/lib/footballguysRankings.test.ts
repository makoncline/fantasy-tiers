import { describe, expect, it } from "vitest";

import {
  buildFootballguysPublicRankings,
  buildFootballguysRankingsUrl,
  isFootballguysRankingsRoadblocked,
  parseFootballguysRankingsHtml,
} from "@/lib/footballguysRankings";

describe("Footballguys rankings", () => {
  it("parses rank, tier, position rank, and selected-source ADP", () => {
    const rows = parseFootballguysRankingsHtml(`
      <table><tbody>
        <tr class="tier-row"><td>Tier 2</td></tr>
        <tr class="player-row" data-playerid="ChasJa00" data-playername="Ja'Marr Chase" data-rank="3">
          <td>3</td><td></td><td class="player-col"><b>Ja'Marr Chase</b><span class="team-abbr"> CIN</span></td>
          <td>WR1</td><td></td><td></td><td></td><td></td><td>6</td>
          <td class="adp"><span class="compare-rank">4.2</span></td>
        </tr>
      </tbody></table>
    `);
    expect(rows).toEqual([{ footballguysId: "ChasJa00", name: "Ja'Marr Chase", team: "CIN", position: "WR", positionRank: 1, overallRank: 3, tier: 2, byeWeek: 6, adp: 4.2 }]);
  });

  it("encodes league settings and ADP source in the request", () => {
    const url = new URL(buildFootballguysRankingsUrl({
      season: "2026",
      scoring: "half",
      teams: 10,
      roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 },
      adpSource: "sleeper-redraft",
    }));
    expect(url.searchParams.get("ppr")).toBe("0.5");
    expect(url.searchParams.get("numTeams")).toBe("10");
    expect(url.searchParams.get("adpSource")).toBe("sleeper-redraft");
  });

  it("detects subscriber-roadblocked custom rankings", () => {
    expect(isFootballguysRankingsRoadblocked('<div data-roadblocked="1"></div>')).toBe(true);
    expect(isFootballguysRankingsRoadblocked('<div data-roadblocked="0"></div>')).toBe(false);
  });

  it("reduces raw source files to one public comparison row", () => {
    const base = {
      fetchedAt: "2026-07-13T12:00:00.000Z",
      sourceUrl: "https://www.footballguys.com/rankings",
      season: "2026",
      scoring: "ppr" as const,
      teams: 12,
      roster: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 },
      access: "public-default" as const,
      warnings: [],
    };
    const row = {
      footballguysId: "ChasJa00",
      name: "Ja'Marr Chase",
      team: "CIN",
      position: "WR",
      positionRank: 1,
      overallRank: 3,
      tier: 2,
      byeWeek: 6,
    };
    const compact = buildFootballguysPublicRankings([
      {
        source: "consensus",
        data: {
          ...base,
          adpSource: "consensus",
          adpRowCount: 1,
          adpCoveragePct: 100,
          rows: [{ ...row, adp: 4.2 }],
        },
      },
      {
        source: "sleeper-redraft",
        data: {
          ...base,
          adpSource: "sleeper-redraft",
          adpRowCount: 1,
          adpCoveragePct: 100,
          rows: [{ ...row, adp: 2.8 }],
        },
      },
    ]);

    expect(compact.rows).toEqual([{
      id: "ChasJa00",
      name: "Ja'Marr Chase",
      position: "WR",
      rank: 3,
      tier: 2,
      posRank: 1,
      adp: { consensus: 4.2, "sleeper-redraft": 2.8 },
    }]);
  });
});
