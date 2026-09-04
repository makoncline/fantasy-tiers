import fs from "node:fs/promises";
import path from "node:path";

import { DraftDetailsSchema } from "../../src/lib/draftDetails";
import { importSleeperDraftBoard } from "../../src/lib/sleeperDraftImport";
import { scoringTypeSchema, type ScoringType } from "../../src/lib/schemas";
import { SleeperLeagueSchema } from "../../src/lib/sleeper";

void main();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error("Provide --input <sleeper-picks.json>");
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(
    args.output ?? path.join(path.dirname(inputPath), "draft-result.json")
  );
  const raw = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const draftDetails = args.draft
    ? DraftDetailsSchema.parse(JSON.parse(await fs.readFile(path.resolve(args.draft), "utf8")))
    : undefined;
  const league = args.league
    ? SleeperLeagueSchema.parse(JSON.parse(await fs.readFile(path.resolve(args.league), "utf8")))
    : undefined;
  const inferredSlot = Number(path.dirname(inputPath).match(/slot-?(\d+)/)?.[1]);
  const userSlot = args.userSlot ?? inferredSlot;
  if (!Number.isInteger(userSlot) || userSlot < 1) {
    throw new Error(
      "Provide --user-slot <number> when it cannot be inferred from the directory name"
    );
  }

  const artifact = importSleeperDraftBoard(raw, {
    userSlot,
    scoring: args.scoring,
    leagueName: args.leagueName,
    draftDetails,
    league,
  });
  await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Imported ${artifact.summary.pickCount} picks to ${outputPath}`);
}

function parseArgs(values: string[]) {
  const result: {
    input?: string;
    draft?: string;
    league?: string;
    output?: string;
    userSlot?: number;
    scoring: ScoringType;
    leagueName: string;
  } = { scoring: "ppr", leagueName: "Imported Sleeper Draft" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index + 1];
    if (values[index] === "--input" && value) result.input = value;
    if (values[index] === "--draft" && value) result.draft = value;
    if (values[index] === "--league" && value) result.league = value;
    if (values[index] === "--output" && value) result.output = value;
    if (values[index] === "--user-slot") result.userSlot = Number(value);
    if (values[index] === "--scoring" && ["std", "ppr", "half"].includes(value ?? "")) {
      result.scoring = scoringTypeSchema.parse(value);
    }
    if (values[index] === "--league-name" && value) result.leagueName = value;
  }
  return result;
}
