import type { Position, RosterSlot } from "@/lib/schemas";

import type { SimBotStrategyId, SimDraftPlayer } from "./index";

export const SIM_BOT_STRATEGY_IDS = [
  "sleeper-adp-needs",
  "sleeper-market-v1",
] as const;

export type BotStrategyContext = {
  available: readonly SimDraftPlayer[];
  needs: Partial<Record<RosterSlot, number>>;
  roster: readonly SimDraftPlayer[];
  round: number;
  rounds: number;
  random: number;
};

export type SimBotStrategy = {
  id: SimBotStrategyId;
  description: string;
  choosePlayer(context: BotStrategyContext): SimDraftPlayer;
  rankPlayers(context: BotStrategyContext): readonly SimDraftPlayer[];
};

const FLEX_POSITIONS = ["RB", "WR", "TE"] as const satisfies readonly Position[];

const strategies = {
  "sleeper-adp-needs": {
    id: "sleeper-adp-needs",
    description: "Top-three Sleeper ADP selection constrained by open starter needs.",
    choosePlayer: chooseAdpNeedsPlayer,
    rankPlayers: rankAdpNeedsPlayers,
  },
  "sleeper-market-v1": {
    id: "sleeper-market-v1",
    description: "Sleeper ADP pressure with soft roster needs and calibrated variance.",
    choosePlayer: chooseMarketPlayer,
    rankPlayers: rankMarketPlayers,
  },
} satisfies Record<SimBotStrategyId, SimBotStrategy>;

export function getSimBotStrategy(id: SimBotStrategyId) {
  return strategies[id];
}

export function rankSimBotPlayers(
  id: SimBotStrategyId,
  context: BotStrategyContext
) {
  return strategies[id].rankPlayers(context);
}

function chooseAdpNeedsPlayer(context: BotStrategyContext) {
  const choices = rankAdpNeedsPlayers(context).slice(0, 3);
  return choices[Math.floor(context.random * choices.length)] ?? choices[0]!;
}

function rankAdpNeedsPlayers(context: BotStrategyContext) {
  const starterPositions = openStarterPositions(context.needs);
  const nonSpecialStarterPositions = starterPositions.filter(
    (position) => position !== "K" && position !== "DEF"
  );
  const isLate = context.round >= Math.max(1, context.rounds - 1);
  let pool = context.available;

  if (nonSpecialStarterPositions.length > 0) {
    pool = context.available.filter((player) =>
      nonSpecialStarterPositions.some((position) => position === player.position)
    );
  } else if (starterPositions.length > 0) {
    const allowed = isLate
      ? starterPositions
      : starterPositions.filter(
          (position) => position !== "K" && position !== "DEF"
        );
    if (allowed.length > 0) {
      pool = context.available.filter((player) =>
        allowed.some((position) => position === player.position)
      );
    }
  } else if ((context.needs.BN ?? 0) > 0) {
    const benchPool = context.available.filter((player) =>
      ["RB", "WR", "TE"].includes(player.position)
    );
    if (benchPool.length > 0) pool = benchPool;
  }

  if (pool.length === 0) pool = context.available;
  return [...pool].sort(compareByMarket(context.round, context.rounds));
}

function chooseMarketPlayer(context: BotStrategyContext) {
  const ranked = rankMarketPlayers(context);
  const choices = ranked.slice(0, 10);
  const weights = [0.31, 0.2, 0.16, 0.1, 0.07, 0.05, 0.04, 0.03, 0.02, 0.02];
  let remaining = context.random;
  for (let index = 0; index < choices.length; index += 1) {
    remaining -= weights[index] ?? 0;
    if (remaining < 0) return choices[index]!;
  }
  return choices[choices.length - 1] ?? ranked[0]!;
}

function rankMarketPlayers(context: BotStrategyContext) {
  const rosterCounts = countPositions(context.roster);
  return [...context.available].sort((a, b) => {
    const difference =
      marketScore(a, context, rosterCounts) -
      marketScore(b, context, rosterCounts);
    return difference || a.name.localeCompare(b.name);
  });
}

function marketScore(
  player: SimDraftPlayer,
  context: BotStrategyContext,
  counts: Record<Position, number>
) {
  let score = botRank(player) + specialTeamPenalty(
    player.position,
    context.round,
    context.rounds
  );
  const directNeed = context.needs[player.position] ?? 0;
  const flexNeed =
    FLEX_POSITIONS.some((position) => position === player.position) &&
    (context.needs.FLEX ?? 0) > 0;

  if (directNeed > 0) score -= 7;
  else if (flexNeed) score -= 3;

  if (player.position === "QB" && counts.QB >= 1) score += 35 * counts.QB;
  if (player.position === "TE" && counts.TE >= 1) score += 25 * counts.TE;
  if ((player.position === "K" || player.position === "DEF") && counts[player.position] >= 1) {
    score += 250;
  }
  return score;
}

function compareByMarket(round: number, rounds: number) {
  return (a: SimDraftPlayer, b: SimDraftPlayer) => {
    const difference =
      botRank(a) + specialTeamPenalty(a.position, round, rounds) -
      (botRank(b) + specialTeamPenalty(b.position, round, rounds));
    return difference || a.name.localeCompare(b.name);
  };
}

function openStarterPositions(needs: Partial<Record<RosterSlot, number>>) {
  const direct = (["QB", "RB", "WR", "TE", "K", "DEF"] as const).filter(
    (position) => (needs[position] ?? 0) > 0
  );
  return (needs.FLEX ?? 0) > 0
    ? Array.from(new Set([...direct, ...FLEX_POSITIONS]))
    : direct;
}

function countPositions(players: readonly SimDraftPlayer[]) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const player of players) counts[player.position] += 1;
  return counts;
}

function specialTeamPenalty(position: Position, round: number, rounds: number) {
  if (position === "K") return round >= rounds ? 0 : 250;
  if (position === "DEF") return round >= rounds - 1 ? 0 : 175;
  return 0;
}

function botRank(player: SimDraftPlayer) {
  return player.sleeperAdp ?? player.sleeperRank ?? player.rank ?? Number.MAX_SAFE_INTEGER;
}
