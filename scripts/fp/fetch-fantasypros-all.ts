import { spawn } from "node:child_process";

const SCORINGS = ["STD", "HALF", "PPR"] as const;
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;

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

async function main() {
  // Fetch projections for all positions and scorings
  for (const scoring of SCORINGS) {
    for (const position of POSITIONS) {
      console.log(`Scraping projections: ${position} ${scoring} draft`);
      await run("node --import=tsx scripts/fp/scrape-fantasypros.ts", {
        SCORING: scoring,
        POSITIONS: position,
      });
    }
  }

  // Fetch ECR for all scorings
  for (const scoring of SCORINGS) {
    console.log(`Scraping ECR: ${scoring}`);
    await run(`node --import=tsx scripts/fp/scrape-ecr-adp.ts ${scoring}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
