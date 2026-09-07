import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

async function main() {
// One cached probe per rolling 24 hours. No retries, pagination, or scheduled use.
process.loadEnvFile(path.resolve(".env.local"));
const key = process.env.FANTASYPROS_API_KEY;
if (!key) throw new Error("FANTASYPROS_API_KEY is missing");
const directory = path.resolve("data/fp-api");
fs.mkdirSync(directory, { recursive: true });
const lock = path.join(directory, "probe.lock");
const lockFd = fs.openSync(lock, "wx", 0o600);
try {
  const ledgerFile = path.join(directory, "probe-usage.json");
  const last = fs.existsSync(ledgerFile) ? z.object({ attemptedAt: z.number() }).parse(JSON.parse(fs.readFileSync(ledgerFile,"utf8"))).attemptedAt : 0;
  if (Date.now() - last < 86400_000) throw new Error("Probe already attempted in the last 24 hours. Read the saved response.");
  fs.writeFileSync(ledgerFile,JSON.stringify({attemptedAt:Date.now()}),{mode:0o600});
  const response = await fetch("https://api.fantasypros.com/public/v2/json/nfl/2026/projections?positions=QB:RB:WR:TE&week=0", { headers: { "x-api-key": key }, signal: AbortSignal.timeout(20000), redirect: "error" });
  const text = (await response.text()).replaceAll(key,"[redacted]");
  fs.writeFileSync(path.join(directory,"preseason-probe.json"), text, {mode:0o600});
  const headers = Object.fromEntries([...response.headers].filter(([name]) => /^(x-)?ratelimit|^retry-after$/i.test(name)));
  let summary: unknown = {status:response.status,headers};
  if (response.ok) {
    const body = z.object({count:z.union([z.string(),z.number()]).optional(), players:z.array(z.object({position_id:z.string().optional()}).passthrough())}).passthrough().parse(JSON.parse(text));
    summary = {status:response.status,headers,reportedCount:body.count,returnedPlayers:body.players.length,positions:body.players.reduce<Record<string,number>>((counts,p)=>{const pos=p.position_id ?? "unknown";counts[pos]=(counts[pos]??0)+1;return counts;},{})};
  }
  fs.writeFileSync(path.join(directory,"probe-summary.json"),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
} finally { fs.closeSync(lockFd); fs.unlinkSync(lock); }

}
main().catch(error => { console.error(error instanceof Error ? error.message : "API probe failed"); process.exitCode = 1; });
