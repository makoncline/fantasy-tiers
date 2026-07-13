import {
  resultDirDraftResult,
  writeFootballguysRequestFromDraftResult,
} from "./draft-result-request";

type Args = {
  draftResult?: string;
  output?: string;
  passingTouchdowns?: string;
  passingYards?: string;
  resultDir?: string;
  slot?: number;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const draftResultPath = args.draftResult ?? resultDirDraftResult(args.resultDir);
  if (!draftResultPath) {
    throw new Error("Provide --draft-result <path> or --result-dir <dir>.");
  }
  if (!args.slot) throw new Error("Provide --slot <draft slot>.");

  const result = await writeFootballguysRequestFromDraftResult({
    draftResultPath,
    outputPath: args.output,
    passingTouchdowns: args.passingTouchdowns,
    passingYards: args.passingYards,
    slot: args.slot,
  });

  console.log(
    JSON.stringify(
      {
        outputPath: result.outputPath,
        slot: args.slot,
        players: result.players,
      },
      null,
      2
    )
  );
}

function parseArgs(args: string[]): Args {
  const parsed: Args = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--draft-result") {
      parsed.draftResult = requireArg(args, (index += 1), arg);
    } else if (arg === "--result-dir") {
      parsed.resultDir = requireArg(args, (index += 1), arg);
    } else if (arg === "--slot") {
      parsed.slot = Number(requireArg(args, (index += 1), arg));
      if (!Number.isInteger(parsed.slot) || parsed.slot <= 0) {
        throw new Error("--slot must be a positive integer.");
      }
    } else if (arg === "--output") {
      parsed.output = requireArg(args, (index += 1), arg);
    } else if (arg === "--passing-yards") {
      parsed.passingYards = requireArg(args, (index += 1), arg);
    } else if (arg === "--passing-touchdowns") {
      parsed.passingTouchdowns = requireArg(args, (index += 1), arg);
    } else if (arg === "--") {
      continue;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function requireArg(args: string[], index: number, flag: string) {
  const value = args[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
