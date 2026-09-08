import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { applyEspnMessage } from "../../src/lib/espn/protocol";

const HarSchema = z.object({ log: z.object({ entries: z.array(z.object({
  request: z.object({ url: z.string() }),
  _webSocketMessages: z.array(z.object({ type: z.string(), data: z.string() })).optional(),
})) }) });
async function main() {
const input = process.argv[2];
if (!input) throw new Error("Usage: node --import=tsx scripts/espn/replay-har.ts <capture.har> [state.json]");
const har = HarSchema.parse(JSON.parse(await readFile(input, "utf8")));
let state: ReturnType<typeof applyEspnMessage> = null;
let streams = 0;
for (const entry of har.log.entries) {
  const url = new URL(entry.request.url);
  if (url.hostname !== "fantasydraft.espn.com") continue;
  streams++;
  for (const frame of entry._webSocketMessages ?? []) {
    if (frame.type === "receive") state = applyEspnMessage(state, frame.data);
  }
}
if (!state) throw new Error("No ESPN draft INIT was found. Export All network requests with WebSocket messages.");
console.log(JSON.stringify({ streams, leagueId: state.leagueId, teamId: state.teamId, state: state.state, picksMade: state.picks.filter((p) => p.playerId !== -1).length, nextPick: state.picks.find((p) => p.playerId === -1)?.pickNumber }));
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(state, null, 2));

}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "HAR replay failed"); process.exitCode = 1; });
