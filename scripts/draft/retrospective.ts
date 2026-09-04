import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DraftDecisionLogSchema } from "../../src/lib/draftDecisionLog";
import {
  buildByeCoverage,
  buildDraftRetrospective,
  type ByeCoverage,
  type RetrospectivePlayerSnapshot,
  type RetrospectiveStrategyCandidate,
} from "../../src/lib/draftRetrospective";
import {
  DraftResultArtifactSchema,
  type DraftResultArtifact,
} from "../../src/lib/draftResults";
import { parsePositiveInteger, requireArgument } from "./cli";

type Args = {
  draftResult?: string;
  resultDir?: string;
  slot?: number;
  top?: number;
};

type DraftResultPlayer = DraftResultArtifact["players"]["all"][number];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const draftResultPath = args.draftResult ?? resultDirDraftResult(args.resultDir);
  if (!draftResultPath) {
    throw new Error("Provide --draft-result <path> or --result-dir <dir>.");
  }

  const resultDir = args.resultDir ?? path.dirname(draftResultPath);
  const artifact = DraftResultArtifactSchema.parse(await readJson(draftResultPath));
  const decisionLogPath = path.join(resultDir, "algorithm-decisions.json");
  const rawDecisionLog = await readOptionalJson(decisionLogPath);
  const decisionLog = rawDecisionLog == null
    ? null
    : DraftDecisionLogSchema.parse(rawDecisionLog);
  const slot = args.slot ?? artifact.summary.userSlot;
  const report = buildDraftRetrospective({
    artifact,
    decisionLog,
    slot,
    top: args.top ?? 8,
  });
  const playersById = new Map(
    artifact.players.all.map((player) => [player.player_id, player])
  );
  const slotPicks = artifact.sleeper.picks.filter(
    (pick) => pick.draft_slot === slot
  );
  const json = {
    generatedAt: new Date().toISOString(),
    draftResultPath,
    decisionLogPath: decisionLog ? decisionLogPath : null,
    slot,
    teamName: slot === artifact.summary.userSlot ? "User" : `Bot ${slot}`,
    sourceSnapshot: report.sourceSnapshot,
    evidenceNote: decisionLog
      ? "Recommendation fields come from the saved canonical decision log. Market fields use saved FantasyPros ECR context."
      : "No canonical recommendation was recorded. This is market-only context.",
    byeCoverage: buildByeCoverage(slotPicks, artifact.players.all),
    picks: report.picks,
  };

  const jsonPath = path.join(resultDir, `draft-retrospective-slot-${slot}.json`);
  const markdownPath = path.join(resultDir, `draft-retrospective-slot-${slot}.md`);
  await writeFile(jsonPath, JSON.stringify(json, null, 2), "utf8");
  await writeFile(markdownPath, renderMarkdown(json), "utf8");
  console.log(JSON.stringify({ jsonPath, markdownPath }, null, 2));
}

function renderMarkdown(data: {
  generatedAt: string;
  slot: number;
  evidenceNote: string;
  byeCoverage: ByeCoverage;
  picks: ReturnType<typeof buildDraftRetrospective>["picks"];
}) {
  const lines = [
    `# Draft Retrospective: Slot ${data.slot}`,
    "",
    `Generated: ${data.generatedAt}`,
    `Evidence: ${data.evidenceNote}`,
    "",
    "## Bye Coverage",
  "",
  ];
  for (const conflict of data.byeCoverage.conflicts) {
    lines.push(
      `- ${conflict.label} Week ${conflict.byeWeek}: ${conflict.players.join(", ")}`
    );
  }
  for (const starter of data.byeCoverage.singleStarterByes) {
    lines.push(
      `- ${starter.position} Week ${starter.byeWeek}: ${starter.player} is the only drafted ${starter.position}; plan a streamer.`
    );
  }
  for (const note of data.byeCoverage.notes) lines.push(`- ${note}`);
  lines.push("", "## Pick Review");
  for (const pick of data.picks) {
    lines.push(
      "",
      `### Pick ${pick.pickNo} / Round ${pick.round}`,
      "",
      `Selected: ${formatMarketPlayer(pick.selected)}`,
      `Strategy best available: ${formatStrategyPlayer(pick.strategyBestAvailable)}`,
      `Market best available: ${formatMarketPlayer(pick.marketBestAvailable)}`,
      `Strategy rank: ${pick.selectedStrategyRank ?? "not recorded"}`,
      `Market rank: ${pick.selectedMarketRank ?? "unknown"}`,
      `Next slot pick: ${pick.nextPickNo ?? "none"}`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function formatMarketPlayer(player: RetrospectivePlayerSnapshot | null) {
  if (!player) return "unknown";
  return `${player.name} (${player.position}, ECR ${player.fpRankAve ?? "missing"})`;
}

function formatStrategyPlayer(player: RetrospectiveStrategyCandidate | null) {
  if (!player) return "not recorded";
  return `${player.name} (${player.position}, Val ${player.staticValue ?? "missing"}, Adj ${player.recommendationScore})`;
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readOptionalJson(file: string) {
  try {
    return await readJson(file);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === "ENOENT") return null;
    throw error;
  }
}

function resultDirDraftResult(resultDir: string | undefined) {
  return resultDir ? path.join(resultDir, "draft-result.json") : undefined;
}

function parseArgs(args: string[]): Args {
  const parsed: Args = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--draft-result") {
      parsed.draftResult = requireArgument(args, (index += 1), arg);
    } else if (arg === "--result-dir") {
      parsed.resultDir = requireArgument(args, (index += 1), arg);
    } else if (arg === "--slot") {
      parsed.slot = parsePositiveInteger(
        requireArgument(args, (index += 1), arg),
        arg
      );
    } else if (arg === "--top") {
      parsed.top = parsePositiveInteger(
        requireArgument(args, (index += 1), arg),
        arg
      );
    } else if (arg !== "--") {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
