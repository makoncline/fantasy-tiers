import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DraftResultArtifactSchema,
  type DraftResultArtifact,
} from "../../src/lib/draftResults";
import type { DraftPick } from "../../src/lib/schemas";

type DraftResultPlayer = DraftResultArtifact["players"]["all"][number];

type Args = {
  draftResult?: string;
  resultDir?: string;
  slot?: number;
  top?: number;
};

type PlayerSnapshot = {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  byeWeek: string | null;
  rank: number | null;
  tier: number | null;
  fpRankAve: number | null;
  fpRankPos: number | null;
  sleeperAdp: number | null;
};

type PickRetrospective = {
  pickNo: number;
  round: number;
  draftSlot: number;
  selected: PlayerSnapshot | null;
  selectedAvailableRank: number | null;
  bestAvailable: PlayerSnapshot | null;
  topAvailable: PlayerSnapshot[];
  topByPosition: Record<string, PlayerSnapshot[]>;
  nextPickNo: number | null;
  passedGoneBeforeNextPick: PlayerSnapshot[];
  passedStillAvailableAtNextPick: PlayerSnapshot[];
};

type ByeCoverage = {
  conflicts: {
    label: string;
    position: string;
    byeWeek: string;
    players: string[];
  }[];
  singleStarterByes: {
    position: string;
    byeWeek: string;
    player: string;
  }[];
  notes: string[];
};

const positions = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const draftResultPath = args.draftResult ?? resultDirDraftResult(args.resultDir);
  if (!draftResultPath) {
    throw new Error("Provide --draft-result <path> or --result-dir <dir>.");
  }

  const resultDir = args.resultDir ?? path.dirname(draftResultPath);
  const artifact = DraftResultArtifactSchema.parse(
    JSON.parse(await readFile(draftResultPath, "utf8"))
  );
  const slot = args.slot ?? artifact.summary.userSlot;
  const top = args.top ?? 8;
  const teamSummary = await readOptionalJson(
    path.join(resultDir, `footballguys-slot-${slot}-summary.json`)
  );

  const playersById = new Map(
    artifact.players.all.map((player) => [player.player_id, player])
  );
  const picks = [...artifact.sleeper.picks].sort(
    (a, b) => a.pick_no - b.pick_no
  );
  const slotPicks = picks.filter((pick) => pick.draft_slot === slot);
  if (!slotPicks.length) throw new Error(`No picks found for slot ${slot}.`);

  const retrospectives = slotPicks.map((pick, index) =>
    buildPickRetrospective({
      pick,
      nextPick: slotPicks[index + 1] ?? null,
      picks,
      players: artifact.players.all,
      playersById,
      top,
    })
  );
  const byeCoverage = buildByeCoverage(slotPicks, playersById);

  const json = {
    generatedAt: new Date().toISOString(),
    draftResultPath,
    slot,
    teamName: slot === artifact.summary.userSlot ? "User" : `Bot ${slot}`,
    finalGrade: readString(teamSummary, "overallGrade"),
    positionGrades: readStringArray(teamSummary, "positionGrades"),
    reportPath: readString(teamSummary, "outputPath"),
    byeCoverage,
    picks: retrospectives,
  };

  const jsonPath = path.join(resultDir, `draft-retrospective-slot-${slot}.json`);
  const markdownPath = path.join(
    resultDir,
    `draft-retrospective-slot-${slot}.md`
  );
  await writeFile(jsonPath, JSON.stringify(json, null, 2), "utf8");
  await writeFile(markdownPath, renderMarkdown(json), "utf8");
  console.log(JSON.stringify({ jsonPath, markdownPath }, null, 2));
}

function buildPickRetrospective(args: {
  pick: DraftPick;
  nextPick: DraftPick | null;
  picks: DraftPick[];
  players: DraftResultPlayer[];
  playersById: Map<string, DraftResultPlayer>;
  top: number;
}): PickRetrospective {
  const draftedBefore = new Set(
    args.picks
      .filter((pick) => pick.pick_no < args.pick.pick_no)
      .map((pick) => pick.player_id)
  );
  const available = sortPlayersOverall(
    args.players.filter((player) => !draftedBefore.has(player.player_id))
  );
  const selected = args.playersById.get(args.pick.player_id) ?? null;
  const selectedAvailableRank = selected
    ? available.findIndex((player) => player.player_id === selected.player_id) + 1
    : null;
  const topAvailable = available.slice(0, args.top);
  const passed = topAvailable.filter(
    (player) => player.player_id !== args.pick.player_id
  );
  const nextPickNo = args.nextPick?.pick_no ?? null;
  const pickedBetween = new Set(
    nextPickNo
      ? args.picks
          .filter(
            (pick) =>
              pick.pick_no > args.pick.pick_no && pick.pick_no < nextPickNo
          )
          .map((pick) => pick.player_id)
      : []
  );
  const passedGoneBeforeNextPick = nextPickNo
    ? passed.filter((player) => pickedBetween.has(player.player_id))
    : [];
  const passedStillAvailableAtNextPick = nextPickNo
    ? passed.filter((player) => !pickedBetween.has(player.player_id))
    : [];

  return {
    pickNo: args.pick.pick_no,
    round: args.pick.round,
    draftSlot: args.pick.draft_slot,
    selected: selected ? snapshotPlayer(selected) : null,
    selectedAvailableRank:
      selectedAvailableRank && selectedAvailableRank > 0
        ? selectedAvailableRank
        : null,
    bestAvailable: topAvailable[0] ? snapshotPlayer(topAvailable[0]) : null,
    topAvailable: topAvailable.map(snapshotPlayer),
    topByPosition: Object.fromEntries(
      positions.map((position) => [
        position,
        sortPlayersByPosition(
          available.filter((player) => player.position === position)
        )
          .slice(0, 3)
          .map(snapshotPlayer),
      ])
    ),
    nextPickNo,
    passedGoneBeforeNextPick: passedGoneBeforeNextPick.map(snapshotPlayer),
    passedStillAvailableAtNextPick:
      passedStillAvailableAtNextPick.map(snapshotPlayer),
  };
}

function sortPlayersOverall(players: DraftResultPlayer[]) {
  return [...players].sort((a, b) => {
    const aRank = overallSortValue(a);
    const bRank = overallSortValue(b);
    return aRank - bRank;
  });
}

function sortPlayersByPosition(players: DraftResultPlayer[]) {
  return [...players].sort((a, b) => {
    const aRank = positionSortValue(a);
    const bRank = positionSortValue(b);
    if (aRank !== bRank) return aRank - bRank;
    return overallSortValue(a) - overallSortValue(b);
  });
}

function overallSortValue(player: DraftResultPlayer) {
  return (
    toNullableNumber(player.fp_rank_ave) ??
    toNullableNumber(player.sleeperAdp) ??
    toNullableNumber(player.rank) ??
    Number.MAX_SAFE_INTEGER
  );
}

function positionSortValue(player: DraftResultPlayer) {
  return (
    toNullableNumber(player.fp_rank_pos) ??
    toNullableNumber(player.rank) ??
    toNullableNumber(player.sleeperAdp) ??
    Number.MAX_SAFE_INTEGER
  );
}

function snapshotPlayer(player: DraftResultPlayer): PlayerSnapshot {
  return {
    playerId: player.player_id,
    name: player.name,
    position: player.position,
    team: player.team,
    byeWeek: player.bye_week,
    rank: toNullableNumber(player.rank),
    tier: toNullableNumber(player.tier),
    fpRankAve: toNullableNumber(player.fp_rank_ave),
    fpRankPos: toNullableNumber(player.fp_rank_pos),
    sleeperAdp: toNullableNumber(player.sleeperAdp),
  };
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function buildByeCoverage(
  slotPicks: DraftPick[],
  playersById: Map<string, DraftResultPlayer>
): ByeCoverage {
  const rosterPlayers = slotPicks
    .map((pick) => playersById.get(pick.player_id) ?? null)
    .filter((player): player is DraftResultPlayer => player != null);
  const positionBye = new Map<string, DraftResultPlayer[]>();
  const flexBye = new Map<string, DraftResultPlayer[]>();

  for (const player of rosterPlayers) {
    const byeWeek = normalizeByeWeek(player.bye_week);
    if (!byeWeek) continue;
    if (player.position === "K" || player.position === "DEF") continue;

    const positionKey = `${player.position}:${byeWeek}`;
    positionBye.set(positionKey, [
      ...(positionBye.get(positionKey) ?? []),
      player,
    ]);

    if (player.position === "RB" || player.position === "WR" || player.position === "TE") {
      flexBye.set(byeWeek, [...(flexBye.get(byeWeek) ?? []), player]);
    }
  }

  const conflicts: ByeCoverage["conflicts"] = [];
  for (const [key, players] of positionBye) {
    if (players.length < 2) continue;
    const [position, byeWeek] = key.split(":");
    if (!position || !byeWeek) continue;
    conflicts.push({
      label: `${position} overlap`,
      position,
      byeWeek,
      players: players.map((player) => player.name),
    });
  }
  for (const [byeWeek, players] of flexBye) {
    if (players.length < 3) continue;
    conflicts.push({
      label: "RB/WR/TE overlap",
      position: "FLEX",
      byeWeek,
      players: players.map((player) => player.name),
    });
  }

  const singleStarterByes: ByeCoverage["singleStarterByes"] = [];
  for (const position of ["QB", "TE"] as const) {
    const players = rosterPlayers.filter((player) => player.position === position);
    if (players.length !== 1) continue;
    const player = players[0];
    const byeWeek = normalizeByeWeek(player?.bye_week);
    if (!player || !byeWeek) continue;
    singleStarterByes.push({
      position,
      byeWeek,
      player: player.name,
    });
  }

  const notes = conflicts.length
    ? [
        "Bye conflicts are not automatic draft mistakes, but they should be reviewed before Week 1 waiver planning.",
      ]
    : ["No major same-position or FLEX bye pileups detected."];

  return { conflicts, singleStarterByes, notes };
}

function normalizeByeWeek(value: string | number | null | undefined) {
  if (value == null) return null;
  const normalized = String(value).trim();
  if (!normalized || normalized === "0") return null;
  return normalized;
}

function renderMarkdown(data: {
  generatedAt: string;
  slot: number;
  teamName: string;
  finalGrade: string | null;
  positionGrades: string[];
  reportPath: string | null;
  byeCoverage: ByeCoverage;
  picks: PickRetrospective[];
}) {
  const lines = [
    `# Draft Retrospective: Slot ${data.slot}`,
    "",
    `Generated: ${data.generatedAt}`,
    `Team: ${data.teamName}`,
    `Final Footballguys grade: ${data.finalGrade ?? "not analyzed"}`,
  ];
  if (data.reportPath) lines.push(`Report: ${data.reportPath}`);
  if (data.positionGrades.length) {
    lines.push("", "Position grades:");
    for (const grade of data.positionGrades) lines.push(`- ${grade}`);
  }
  lines.push("", "Bye coverage:");
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
      `Selected: ${formatPlayer(pick.selected)}${
        pick.selectedAvailableRank
          ? ` (available rank ${pick.selectedAvailableRank})`
          : ""
      }`,
      `Best available: ${formatPlayer(pick.bestAvailable)}`,
      `Next slot pick: ${pick.nextPickNo ?? "none"}`
    );
    lines.push("", "Top available:");
    for (const player of pick.topAvailable) {
      lines.push(`- ${formatPlayer(player)}`);
    }
    lines.push("", "Passed players gone before next pick:");
    for (const player of pick.passedGoneBeforeNextPick) {
      lines.push(`- ${formatPlayer(player)}`);
    }
    if (!pick.passedGoneBeforeNextPick.length) lines.push("- none");
    lines.push("", "Passed players still available at next pick:");
    for (const player of pick.passedStillAvailableAtNextPick) {
      lines.push(`- ${formatPlayer(player)}`);
    }
    if (!pick.passedStillAvailableAtNextPick.length) lines.push("- none");
  }
  lines.push("");
  return lines.join("\n");
}

function formatPlayer(player: PlayerSnapshot | null) {
  if (!player) return "unknown";
  const details = [
    player.position,
    player.team ?? "FA",
    player.rank == null ? null : `rank ${player.rank}`,
    player.tier == null ? null : `tier ${player.tier}`,
    player.sleeperAdp == null ? null : `ADP ${player.sleeperAdp}`,
  ].filter(Boolean);
  return `${player.name} (${details.join(", ")})`;
}

async function readOptionalJson(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function readStringArray(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function resultDirDraftResult(resultDir: string | undefined) {
  return resultDir ? path.join(resultDir, "draft-result.json") : undefined;
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
    } else if (arg === "--top") {
      parsed.top = Number(requireArg(args, (index += 1), arg));
      if (!Number.isInteger(parsed.top) || parsed.top <= 0) {
        throw new Error("--top must be a positive integer.");
      }
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
