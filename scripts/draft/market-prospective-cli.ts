import { createServer } from "node:http";
import { z } from "zod";
import { runMarketCapture } from "./market-prospective";

const RequestSchema = z.object({ mode: z.enum(["init", "turn", "finish"]), draftId: z.string().regex(/^\d+$/), userId: z.string().regex(/^\d+$/).optional(), selectedId: z.string().optional() });
const [mode, root, draftId, userId, selectedId] = process.argv.slice(2);
if (!root || !mode) throw new Error("Usage: market-prospective-cli.ts freeze|serve|init|turn|finish ROOT [DRAFT_ID USER_ID SELECTED_ID]");
if (mode === "serve") {
  // Loopback transport. Only this local origin can submit browser requests.
  let busy = false;
  createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><title>Prospective capture</title><p>Local fantasy draft evidence collector. Active selections are unchanged.</p>"); return; }
    if (req.method !== "POST" || (req.headers.origin && req.headers.origin !== "http://127.0.0.1:3116") || req.headers["content-type"] !== "application/json") { res.writeHead(403).end(); return; }
    if (busy) { res.writeHead(409).end("Capture already running"); return; }
    busy = true;
    try {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 4096) throw new Error("Request too large"); }
      const input = RequestSchema.parse(JSON.parse(body));
      const result = await runMarketCapture(input.mode, root, input.draftId, input.userId, input.selectedId);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      console.log(JSON.stringify({ at: new Date().toISOString(), mode: input.mode, draftId: input.draftId, result }));
    } catch (error) { res.writeHead(400).end(JSON.stringify({ error: error instanceof Error ? error.message : "Capture failed" })); }
    finally { busy = false; }
  }).listen(3116, "127.0.0.1", () => console.log("Prospective collector on loopback port 3116"));
} else {
  runMarketCapture(mode, root, draftId, userId, selectedId).then((v) => console.log(JSON.stringify(v))).catch((e: unknown) => { console.error(e); process.exitCode = 1; });
}
