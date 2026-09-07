import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadFantasyProsProjectionSource } from "../../src/lib/fantasyProsProjectionSource";
const Capture = z.record(z.string(), z.object({ url: z.string().url(), heading: z.string(), headers: z.string(), rows: z.array(z.array(z.union([z.string(), z.object({ name: z.string(), href: z.string(), text: z.string() })]))) }));
const columns = {
  QB: ["PASSING_ATT", "CMP", "PASSING_YDS", "PASSING_TDS", "INTS", "RUSHING_ATT", "RUSHING_YDS", "RUSHING_TDS", "FL", "FPTS"],
  RB: ["ATT", "RUSHING_YDS", "RUSHING_TDS", "REC", "RECEIVING_YDS", "RECEIVING_TDS", "FL", "FPTS"],
  WR: ["REC", "RECEIVING_YDS", "RECEIVING_TDS", "ATT", "RUSHING_YDS", "RUSHING_TDS", "FL", "FPTS"],
  TE: ["REC", "YDS", "TDS", "FL", "FPTS"],
};
const headers = { QB: "PLAYER ATT CMP YDS TDS INTS ATT YDS TDS FL FPTS", RB: "PLAYER ATT YDS TDS REC YDS TDS FL FPTS", WR: "PLAYER REC YDS TDS ATT YDS TDS FL FPTS", TE: "PLAYER REC YDS TDS FL FPTS" };
const capture = Capture.parse(JSON.parse(fs.readFileSync(process.argv[2] ?? "", "utf8")));
const outputs = Object.entries(columns).map(([position, keys]) => {
  const input = capture[position];
  if (!input || input.rows.length < 30) throw new Error(`${position}: incomplete capture`);
  const expected = Reflect.get(headers, position);
  if (!input.headers.replace(/\s+/g, " ").includes(expected)) throw new Error(`${position}: headers changed`);
  const dateText = input.heading.replace("Consensus last updated ", "");
  const date = new Date(dateText).toISOString().slice(0,10);
  const rows = input.rows.map(cells => {
    const player = cells[0];
    if (!player || typeof player === "string" || cells.length !== keys.length + 1) throw new Error(`${position}: invalid row`);
    const stats = keys.map((key, i) => {
      const value = cells[i+1];
      if (typeof value !== "string" || !value.trim() || !Number.isFinite(Number(value.replaceAll(",", "")))) throw new Error(`${position}: invalid ${key}`);
      return [`${key}_AVG`, value];
    });
    return { Player: player.name, Team: player.text.replace(player.name, "").trim(), PlayerFilename: player.href.split('/').pop(), ...Object.fromEntries(stats) };
  });
  return { position, data: { meta: { source: "FantasyPros", position, week: "draft", scoring: "HALF", date, scrapedAt: new Date().toISOString(), rowCount: rows.length, url: input.url, captureMethod: "signed-in browser DOM", columns: keys.map(k=>`${k}_AVG`) }, rows } };
});
fs.mkdirSync(path.resolve("public/data/fantasypros/raw"), { recursive: true });
for (const { position, data } of outputs) {
  fs.writeFileSync(path.resolve(`public/data/fantasypros/raw/${position}-half-draft_raw.json`), JSON.stringify(data,null,2));
  console.log(`${position}: ${data.rows.length} rows, ${data.meta.date}`);
}

fs.writeFileSync(path.resolve("public/data/aggregate/fantasypros-draft-projections.json"), JSON.stringify(loadFantasyProsProjectionSource(),null,2));
