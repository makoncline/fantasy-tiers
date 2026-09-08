import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { readPublishedFantasyProsProjections } from "../../src/lib/fantasyProsProjectionSource";
import { normalizePlayerName } from "../../src/lib/util";
import { SheetDataSchema, WIFE_RULES } from "../../src/backup/model";

async function main() {
  const bundles = Object.fromEntries(["std", "half", "ppr"].map(scoring => [scoring, buildAggregateBundle({ scoring: scoring === "std" ? "std" : scoring === "half" ? "half" : "ppr", teams: WIFE_RULES.teams, rosterSlots: WIFE_RULES.roster })]));
  const bundle = bundles.ppr!;
  const fp = readPublishedFantasyProsProjections();
  if (fp.problems.length || !fp.updatedAt || !bundle.draftProjections) throw new Error(`Backup data incomplete: ${fp.problems.join(" ")}`);
  const fpStats = new Map(fp.rows.map(p => [`${normalizePlayerName(p.name)}:${p.position}`, p.stats]));
  const positions = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;
  const players = positions.flatMap(pos => bundle.shards[pos].map(p => {
    const ranks = Object.fromEntries(Object.entries(bundles).map(([scoring, b]) => {
      const row = b.shards[pos].find(r => r.player_id === p.player_id)!;
      return [scoring, { tier: row.tiers.tier, overall: b.shards.ALL.find(r => r.player_id === p.player_id)?.tiers.tier ?? null, flex: b.shards.FLEX.find(r => r.player_id === p.player_id)?.tiers.tier ?? null, ecr: b.shards.ALL.find(r => r.player_id === p.player_id)?.fantasypros.ecr_average ?? row.fantasypros.ecr_average, adp: row.sleeper.adp != null && row.sleeper.adp > 0 && row.sleeper.adp < 999 ? row.sleeper.adp : null }];
    }));
    return { id: p.player_id, name: p.name, pos, team: p.team, bye: p.bye_week, status: p.sleeper.injuryStatus, ranks,
      stats: pos === "K" || pos === "DEF" ? bundle.draftProjections!.players[p.player_id]?.stats ?? null : fpStats.get(`${normalizePlayerName(p.name)}:${pos}`) ?? null };
  })).filter(p => p.stats || Object.values(p.ranks).some(r => r.ecr != null || (p.team != null && r.adp != null && r.adp > 0 && r.adp < 400)));
  const data = SheetDataSchema.parse({ season: bundle.draftProjections.season, fpDate: fp.updatedAt, sleeperDate: bundle.draftProjections.fetchedAt, rankingsDate: bundle.sourceHealth?.sources.find(s => s.source === "FantasyPros")?.fetchedAt ?? bundle.lastModified, players });
  if (players.length < 250) throw new Error("Backup player pool is incomplete.");
  const js = await build({ entryPoints: ["src/backup/app.tsx"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true, define: { "process.env.NODE_ENV": '"production"' } });
  const css = await readFile("src/backup/style.css", "utf8");
  const serialized = JSON.stringify(data).replaceAll("<", "\\u003c");
  const script = js.outputFiles[0]!.text.replaceAll("</script", "<\\/script");
  await writeFile("public/espn-backup.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'"><title>Draft backup</title><style>${css}</style></head><body><div id="root">Opening draft backup…</div><noscript>Enable JavaScript to use this sheet.</noscript><script id="sheet-data" type="application/json">${serialized}</script><script id="sheet-app">${script}</script></body></html>`);
  console.log(`Built offline draft sheet: ${players.length} players; FP ${data.fpDate}; Sleeper ${data.sleeperDate}.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
