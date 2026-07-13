import * as cheerio from "cheerio";
import { z } from "zod";

export const FOOTBALLGUYS_ADP_SOURCES = [
  "bestball10s",
  "cbs",
  "consensus",
  "draftkings-bestball",
  "drafters",
  "espn",
  "mfl",
  "nffc",
  "nfl",
  "rtsports",
  "sleeper-redraft",
  "underdog",
  "yahoo",
] as const;

export const FootballguysAdpSourceSchema = z.enum(FOOTBALLGUYS_ADP_SOURCES);

export const FootballguysRankingRowSchema = z.object({
  footballguysId: z.string().min(1),
  name: z.string().min(1),
  team: z.string().nullable(),
  position: z.string().min(1),
  positionRank: z.number().int().min(1),
  overallRank: z.number().int().min(1),
  tier: z.number().int().min(1),
  byeWeek: z.number().int().min(1).nullable(),
  adp: z.number().nullable(),
});

export const FootballguysRankingsFileSchema = z.object({
  fetchedAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  season: z.string(),
  scoring: z.enum(["std", "ppr", "half"]),
  teams: z.number().int().min(2),
  roster: z.object({ QB: z.number(), RB: z.number(), WR: z.number(), TE: z.number(), FLEX: z.number() }),
  adpSource: FootballguysAdpSourceSchema,
  access: z.enum(["public-default", "custom-member"]),
  adpRowCount: z.number().int().min(0),
  adpCoveragePct: z.number().min(0).max(100),
  warnings: z.array(z.string()),
  rows: z.array(FootballguysRankingRowSchema),
});

export const FootballguysPublicRankingsSchema = z.object({
  version: z.literal(1),
  fetchedAt: z.string().datetime(),
  season: z.string(),
  scoring: z.enum(["std", "ppr", "half"]),
  teams: z.number().int().min(2),
  settings: z.string().min(1),
  sources: z.array(z.object({
    source: FootballguysAdpSourceSchema,
    rowCount: z.number().int().min(0),
    adpRowCount: z.number().int().min(0),
    adpCoveragePct: z.number().min(0).max(100),
  })),
  rows: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    position: z.string().min(1),
    rank: z.number().int().min(1),
    tier: z.number().int().min(1),
    posRank: z.number().int().min(1),
    adp: z.record(z.string(), z.number().nullable()),
  })),
});

export type FootballguysAdpSource = z.infer<typeof FootballguysAdpSourceSchema>;
export type FootballguysRankingsFile = z.infer<typeof FootballguysRankingsFileSchema>;

export function buildFootballguysPublicRankings(
  datasets: ReadonlyArray<{
    source: FootballguysAdpSource;
    data: FootballguysRankingsFile;
  }>
) {
  const rankDataset =
    datasets.find((dataset) => dataset.source === "consensus") ?? datasets[0];
  if (!rankDataset) throw new Error("Footballguys rankings cache is empty");

  const adpById = new Map<string, Record<string, number | null>>();
  for (const dataset of datasets) {
    for (const row of dataset.data.rows) {
      const adp = adpById.get(row.footballguysId) ?? {};
      adp[dataset.source] = row.adp;
      adpById.set(row.footballguysId, adp);
    }
  }

  return FootballguysPublicRankingsSchema.parse({
    version: 1,
    fetchedAt: rankDataset.data.fetchedAt,
    season: rankDataset.data.season,
    scoring: rankDataset.data.scoring,
    teams: rankDataset.data.teams,
    settings: `${rankDataset.data.teams}-team ${rankDataset.data.scoring} public default`,
    sources: datasets.map(({ source, data }) => ({
      source,
      rowCount: data.rows.length,
      adpRowCount: data.adpRowCount,
      adpCoveragePct: data.adpCoveragePct,
    })),
    rows: rankDataset.data.rows.map((row) => ({
      id: row.footballguysId,
      name: row.name,
      position: row.position,
      rank: row.overallRank,
      tier: row.tier,
      posRank: row.positionRank,
      adp: adpById.get(row.footballguysId) ?? {},
    })),
  });
}

export function parseFootballguysRankingsHtml(html: string) {
  const $ = cheerio.load(html);
  let tier = 0;
  const rows: z.infer<typeof FootballguysRankingRowSchema>[] = [];
  $("table tbody tr").each((_, element) => {
    const row = $(element);
    if (row.hasClass("tier-row")) {
      tier = numberFromText(row.text()) ?? tier;
      return;
    }
    const footballguysId = row.attr("data-playerid");
    const overallRank = numberFromText(row.attr("data-rank") ?? "");
    const positionLabel = row.find("td").eq(3).text().trim();
    const positionMatch = positionLabel.match(/^([A-Z]+)(\d+)$/);
    if (!footballguysId || overallRank == null || !positionMatch || tier < 1) return;

    rows.push(FootballguysRankingRowSchema.parse({
      footballguysId,
      name: row.attr("data-playername") ?? row.find(".player-col b").text().trim(),
      team: row.find(".team-abbr").text().trim() || null,
      position: positionMatch[1],
      positionRank: Number(positionMatch[2]),
      overallRank,
      tier,
      byeWeek: numberFromText(row.find("td").eq(8).text()),
      adp: numberFromText(row.find(".adp .compare-rank").text()),
    }));
  });
  return rows;
}

export function isFootballguysRankingsRoadblocked(html: string) {
  const $ = cheerio.load(html);
  return $("[data-roadblocked='1']").length > 0;
}

export function buildFootballguysRankingsUrl(input: {
  season: string;
  scoring: "std" | "ppr" | "half";
  teams: number;
  roster: { QB: number; RB: number; WR: number; TE: number; FLEX: number };
  adpSource: FootballguysAdpSource;
}) {
  const ppr = input.scoring === "ppr" ? 1 : input.scoring === "half" ? 0.5 : 0;
  const url = new URL("https://www.footballguys.com/rankings");
  const params = {
    componentIdNum: "1",
    ppr: String(ppr),
    pp1d: "0",
    "pass-yds": "25",
    "pass-td": "4",
    "pass-int": "-1",
    "rec-rec-te": "0",
    "qb,rb,wr,te": "0",
    qb: String(input.roster.QB),
    rb: String(input.roster.RB),
    wr: String(input.roster.WR),
    te: String(input.roster.TE),
    "rb,wr,te": String(input.roster.FLEX),
    "qb-team": "0",
    numTeams: String(input.teams),
    consensus: "1",
    pos: "all",
    adpSource: input.adpSource,
    year: input.season,
    week: "0",
    durationTypeKey: "preseason",
    rankerId: "0",
    reload: "1",
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function numberFromText(value: string) {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
