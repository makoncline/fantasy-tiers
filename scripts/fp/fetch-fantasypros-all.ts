import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SCORINGS = ["STD", "HALF", "PPR"] as const;
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
const OUT_DIR = path.resolve("public", "data", "fantasypros");
const RAW_DIR = path.join(OUT_DIR, "raw");

function run(cmd: string, env: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, {
      shell: true,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function detectWeek(): number {
  const envWeek = Number(process.env.FP_WEEK || process.env.WEEK);
  if (Number.isFinite(envWeek) && envWeek > 0) return envWeek;
  try {
    const p = path.resolve(
      "public",
      "data",
      "sleeper",
      "projections-latest.json"
    );
    if (fs.existsSync(p)) {
      const txt = fs.readFileSync(p, "utf8");
      const json = JSON.parse(txt);
      const first = Array.isArray(json) ? json[0] : json;
      const w = Number(first?.week);
      if (Number.isFinite(w) && w > 0) return w;
    }
  } catch {}
  return 1;
}

function envFlag(name: string): boolean {
  return /^(1|true|yes)$/i.test(String(process.env[name] || ""));
}

function writeFetchMode(
  mode: "draft" | "weekly",
  week?: number,
  options: { projectionsFetched?: boolean } = {}
) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RAW_DIR, "fetch-mode.json"),
    JSON.stringify(
      {
        source: "FantasyPros",
        mode,
        season: process.env.SEASON ?? "2026",
        week: week ?? null,
        projectionsFetched: options.projectionsFetched ?? false,
        fetchedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
}

async function main() {
  const isDraft = envFlag("DRAFT");
  if (isDraft) {
    console.log("[fetch:fp] DRAFT=true → scraping draft data only");
    const fetchProjections = envFlag("FP_FETCH_PROJECTIONS");
    if (fetchProjections) {
      // Draft projections for all positions/scorings. FantasyPros may fence these
      // pages; scrape-fantasypros refuses to write short/partial responses.
      for (const scoring of SCORINGS) {
        for (const position of POSITIONS) {
          console.log(`Scraping projections: ${position} ${scoring} draft`);
          await run("node --import=tsx scripts/fp/scrape-fantasypros.ts", {
            SCORING: scoring,
            POSITIONS: position,
          });
        }
      }
    } else {
      console.log(
        "[fetch:fp] Skipping FantasyPros projections. Set FP_FETCH_PROJECTIONS=true to attempt them."
      );
    }
    // Draft ECR for all scorings
    for (const scoring of SCORINGS) {
      console.log(`Scraping ECR: ${scoring} draft`);
      await run(
        `node --import=tsx scripts/fp/scrape-ecr-adp.ts draft ${scoring}`
      );
    }
    writeFetchMode("draft", undefined, {
      projectionsFetched: fetchProjections,
    });
    return;
  }

  console.log("[fetch:fp] DRAFT not set → scraping weekly data only");
  const week = detectWeek();
  console.log(`Scraping weekly ECR for current week (detected ${week})`);
  const POS_WITH_VARIANTS = ["RB", "WR", "TE", "FLEX"] as const;
  for (const pos of POS_WITH_VARIANTS) {
    for (const scoring of SCORINGS) {
      console.log(`Scraping weekly ECR: ${pos} ${scoring}`);
      await run(
        `node --import=tsx scripts/fp/scrape-ecr-adp.ts weekly ${pos} ${scoring}`
      );
    }
  }
  const STD_ONLY = ["QB", "K", "DST"] as const;
  for (const pos of STD_ONLY) {
    console.log(`Scraping weekly ECR: ${pos} STD`);
    await run(
      `node --import=tsx scripts/fp/scrape-ecr-adp.ts weekly ${pos} STD`
    );
  }
  writeFetchMode("weekly", week, { projectionsFetched: false });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
