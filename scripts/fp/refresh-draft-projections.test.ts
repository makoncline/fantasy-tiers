import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import { refreshDraftProjections } from "./refresh-draft-projections";
import { inferDate, scrapeOne } from "./scrape-fantasypros";

it("publishes all four validated tables atomically and retains the good snapshot on failed, truncated, or stale refreshes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fp-refresh-test-"));
  const output = path.join(dir,"published.json");
  const now = new Date("2026-09-07T18:00:00Z");
  let failure = "";
  const calls: string[] = [];
  const scrape: typeof scrapeOne = async (position, scoring, week, staging) => {
    calls.push(position);
    if (failure === "network" && position === "TE") throw new Error("Fetch failed");
    const count = failure === "truncated" ? 10 : 90;
    const fields = ["PASSING_YDS","PASSING_TDS","INTS","RUSHING_YDS","RUSHING_TDS","REC","RECEIVING_YDS","RECEIVING_TDS","YDS","TDS","FL"];
    await fs.mkdir(path.join(staging,"raw"), {recursive:true});
    await fs.writeFile(path.join(staging,"raw",`${position}-half-draft_raw.json`), JSON.stringify({ meta:{source:"FantasyPros",position,week,date:failure === "stale" ? "2026-08-01" : "2026-09-07",rowCount:count}, rows:Array.from({length:count},(_,i)=>({Player:`${position} ${i}`,...Object.fromEntries(fields.map(f=>[`${f}_AVG`,"1"]))})) }));
  };
  try {
    expect(await refreshDraftProjections({output,scrape,now})).toEqual({rows:360,updatedAt:"2026-09-07"});
    expect(calls).toEqual(["QB","RB","WR","TE"]);
    const original = await fs.readFile(output,"utf8");
    for (failure of ["network","truncated","stale"]) {
      await expect(refreshDraftProjections({output,scrape,now})).rejects.toThrow();
      expect(await fs.readFile(output,"utf8")).toBe(original);
    }
    expect(inferDate('<body>Sep 7, 2026<h2>Consensus last updated <span>Sep 6, 2026</span></h2></body>')).toBe("2026-09-06");
    expect(inferDate('<body>Sep 7, 2026</body>')).toBeNull();
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
