import type {
  AlgorithmDraftCandidate,
  DraftDecisionLog,
} from "@/lib/draftDecisionLog";
import { createPlayerPoolSignature } from "@/lib/draftDecisionLog.server";
import type { DraftResultArtifact } from "@/lib/draftResults";
import type { DraftPick } from "@/lib/schemas";

type DraftResultPlayer = DraftResultArtifact["players"]["all"][number];

export type ByeCoverage = {
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

export type RetrospectivePlayerSnapshot = {
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

export function buildDraftRetrospective(input: {
  artifact: DraftResultArtifact;
  decisionLog: DraftDecisionLog | null;
  slot: number;
  top: number;
}) {
  validateDecisionLog(input);
  const playersById = new Map(
    input.artifact.players.all.map((player) => [player.player_id, player])
  );
  const picks = input.artifact.sleeper.picks.toSorted(
    (left, right) => left.pick_no - right.pick_no
  );
  const slotPicks = picks.filter((pick) => pick.draft_slot === input.slot);
  if (slotPicks.length === 0) {
    throw new Error(`No picks found for slot ${input.slot}.`);
  }
  const decisionsByPick = new Map(
    input.decisionLog?.decisions.map((decision) => [decision.pickNo, decision])
  );
  if (input.decisionLog) {
    const missingPick = slotPicks.find(
      (pick) => !decisionsByPick.has(pick.pick_no)
    );
    if (missingPick) {
      throw new Error(`Canonical decision is missing for pick ${missingPick.pick_no}.`);
    }
  }

  return {
    sourceSnapshot: input.decisionLog?.sourceSnapshot ??
      input.artifact.assistant.sourceSnapshot ?? {
      aggregateLastModified: null,
      aggregateGeneratedAt:
        input.artifact.assistant.sourceHealth?.generatedAt ?? null,
      projectionFetchedAt: null,
      projectionSourceLastModified: null,
      playerPoolSize: input.artifact.players.all.length,
    },
    picks: slotPicks.map((pick, index) => buildPick({
      pick,
      nextPick: slotPicks[index + 1] ?? null,
      allPicks: picks,
      players: input.artifact.players.all,
      playersById,
      decision: decisionsByPick.get(pick.pick_no) ?? null,
      top: input.top,
    })),
  };
}

function validateDecisionLog(input: {
  artifact: DraftResultArtifact;
  decisionLog: DraftDecisionLog | null;
  slot: number;
}) {
  if (!input.decisionLog) {
    if (input.artifact.source === "mock-draft") {
      throw new Error(
        "Algorithm retrospectives require a validated canonical decision log."
      );
    }
    return;
  }
  const config = input.artifact.state.config;
  const league = input.decisionLog.league;
  if (
    league.teams !== config.teams ||
    league.rounds !== config.rounds ||
    league.slot !== config.userSlot ||
    league.seed !== config.seed ||
    league.draftType !== config.draftType ||
    league.botStrategy !== config.botStrategy ||
    JSON.stringify(league.rosterSlots) !== JSON.stringify(config.rosterSlots) ||
    JSON.stringify(league.scoringRules) !== JSON.stringify(config.scoringRules)
  ) {
    throw new Error("Decision log league identity does not match the draft result.");
  }
  if (input.slot !== league.slot) {
    throw new Error("Canonical decisions are available only for the saved user slot.");
  }
  if (
    input.decisionLog.sourceSnapshot.playerPoolSize !==
      input.artifact.players.all.length ||
    input.decisionLog.sourceSnapshot.playerPoolSignature !==
      createPlayerPoolSignature(input.artifact.players.all)
  ) {
    throw new Error("Decision log player pool does not match the draft result.");
  }
  const artifactSnapshot = input.artifact.assistant.sourceSnapshot;
  if (!artifactSnapshot) {
    throw new Error("Draft result does not include a source snapshot.");
  }
  if (!sameSourceSnapshot(artifactSnapshot, input.decisionLog.sourceSnapshot)) {
    throw new Error("Decision log source snapshot does not match the draft result.");
  }
}

function sameSourceSnapshot(
  left: DraftResultArtifact["assistant"]["sourceSnapshot"],
  right: DraftDecisionLog["sourceSnapshot"]
) {
  return left != null &&
    left.aggregateLastModified === right.aggregateLastModified &&
    left.aggregateGeneratedAt === right.aggregateGeneratedAt &&
    left.projectionFetchedAt === right.projectionFetchedAt &&
    left.projectionSourceLastModified === right.projectionSourceLastModified &&
    left.playerPoolSize === right.playerPoolSize &&
    left.playerPoolSignature === right.playerPoolSignature;
}

export function buildByeCoverage(
  slotPicks: readonly DraftPick[],
  allPlayers: readonly DraftResultPlayer[]
): ByeCoverage {
  const playersById = new Map(
    allPlayers.map((player) => [player.player_id, player])
  );
  const rosterPlayers = slotPicks.flatMap((pick) => {
    const player = playersById.get(pick.player_id);
    return player ? [player] : [];
  });
  const positionBye = new Map<string, DraftResultPlayer[]>();
  const flexBye = new Map<string, DraftResultPlayer[]>();

  for (const player of rosterPlayers) {
    const byeWeek = normalizeByeWeek(player.bye_week);
    if (!byeWeek || player.position === "K" || player.position === "DEF") {
      continue;
    }
    const positionKey = `${player.position}:${byeWeek}`;
    positionBye.set(positionKey, [
      ...(positionBye.get(positionKey) ?? []),
      player,
    ]);
    if (
      player.position === "RB" ||
      player.position === "WR" ||
      player.position === "TE"
    ) {
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
    const players = rosterPlayers.filter(
      (player) => player.position === position
    );
    const player = players.length === 1 ? players[0] : null;
    const byeWeek = normalizeByeWeek(player?.bye_week);
    if (!player || !byeWeek) continue;
    singleStarterByes.push({ position, byeWeek, player: player.name });
  }

  return {
    conflicts,
    singleStarterByes,
    notes: conflicts.length
      ? [
          "Bye conflicts are not automatic draft mistakes, but they should be reviewed before Week 1 waiver planning.",
        ]
      : ["No major same-position or FLEX bye pileups detected."],
  };
}

function buildPick(input: {
  pick: DraftPick;
  nextPick: DraftPick | null;
  allPicks: DraftPick[];
  players: DraftResultPlayer[];
  playersById: Map<string, DraftResultPlayer>;
  decision: DraftDecisionLog["decisions"][number] | null;
  top: number;
}) {
  if (input.decision && input.decision.selected.playerId !== input.pick.player_id) {
    throw new Error(
      `Decision pick ${input.pick.pick_no} selected ${input.decision.selected.playerId}, ` +
      `but the draft selected ${input.pick.player_id}.`
    );
  }
  const draftedBefore = new Set(
    input.allPicks
      .filter((pick) => pick.pick_no < input.pick.pick_no)
      .map((pick) => pick.player_id)
  );
  const marketAvailable = input.players
    .filter((player) => !draftedBefore.has(player.player_id))
    .toSorted((left, right) => marketRank(left) - marketRank(right));
  const selectedMarketRank = marketAvailable.findIndex(
    (player) => player.player_id === input.pick.player_id
  );
  const selectedStrategyRank = input.decision?.topOptions.findIndex(
    (player) => player.playerId === input.pick.player_id
  ) ?? -1;
  const nextPickNo = input.nextPick?.pick_no ?? null;
  const pickedBetween = new Set(
    nextPickNo == null
      ? []
      : input.allPicks
          .filter(
            (pick) => pick.pick_no > input.pick.pick_no && pick.pick_no < nextPickNo
          )
          .map((pick) => pick.player_id)
  );
  const strategyPassed = (input.decision?.topOptions ?? [])
    .slice(0, input.top)
    .filter((player) => player.playerId !== input.pick.player_id);

  return {
    pickNo: input.pick.pick_no,
    round: input.pick.round,
    draftSlot: input.pick.draft_slot,
    canonicalDecisionRecorded: input.decision != null,
    selected: snapshotPlayer(
      input.playersById.get(input.pick.player_id) ?? null
    ),
    selectedMarketRank: selectedMarketRank < 0 ? null : selectedMarketRank + 1,
    selectedStrategyRank:
      selectedStrategyRank < 0 ? null : selectedStrategyRank + 1,
    strategyBestAvailable: input.decision?.topOptions[0] ?? null,
    strategyTopAvailable: input.decision?.topOptions.slice(0, input.top) ?? [],
    marketBestAvailable: snapshotPlayer(marketAvailable[0] ?? null),
    marketTopAvailable: marketAvailable.slice(0, input.top).map(snapshotPlayer),
    nextPickNo,
    strategyPassedGoneBeforeNextPick: strategyPassed.filter((player) =>
      pickedBetween.has(player.playerId)
    ),
    strategyPassedStillAvailableAtNextPick: strategyPassed.filter((player) =>
      !pickedBetween.has(player.playerId)
    ),
  };
}

function snapshotPlayer(
  player: DraftResultPlayer | null
): RetrospectivePlayerSnapshot | null {
  if (!player) return null;
  return {
    playerId: player.player_id,
    name: player.name,
    position: player.position,
    team: player.team,
    byeWeek: player.bye_week,
    rank: finiteNumber(player.rank),
    tier: finiteNumber(player.tier),
    fpRankAve: finiteNumber(player.fp_rank_ave),
    fpRankPos: finiteNumber(player.fp_rank_pos),
    sleeperAdp: finiteNumber(player.sleeperAdp),
  };
}

function marketRank(player: DraftResultPlayer) {
  return finiteNumber(player.fp_rank_ave) ?? Number.MAX_SAFE_INTEGER;
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

function normalizeByeWeek(value: string | number | null | undefined) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return !normalized || normalized === "0" ? null : normalized;
}

export type RetrospectiveStrategyCandidate = AlgorithmDraftCandidate;
