import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { glob } from "glob";
import { z } from "zod";

import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { DraftPicksSchema, PositionEnum } from "../../src/lib/schemas";
import {
  bundleToSimPlayers,
  createDefaultSimDraftConfig,
  createSimDraft,
  getBotStrategyContext,
  type SimDraftPlayer,
  type SimBotStrategyId,
} from "../../src/lib/simDraft";
import {
  rankSimBotPlayers,
  SIM_BOT_STRATEGY_IDS,
} from "../../src/lib/simDraft/botStrategies";

const RawPickSchema = z.object({
  draft_slot: z.number(),
  round: z.number(),
  pick_no: z.number(),
  player_id: z.string(),
  metadata: z.object({
    first_name: z.string().optional().default(""),
    last_name: z.string().optional().default(""),
    position: PositionEnum,
    team: z.string().optional().default(""),
  }),
});

void main();

async function main() {
  const files = (
    await glob("data/draft-results/**/sleeper-picks.json", { nodir: true })
  ).sort();
  const completeBoards = [];
  for (const file of files) {
    const picks = z.array(RawPickSchema).parse(
      JSON.parse(await readFile(file, "utf8"))
    );
    const teams = Math.max(...picks.map((pick) => pick.draft_slot));
    const rounds = Math.max(...picks.map((pick) => pick.round));
    if (picks.length === teams * rounds) completeBoards.push({ file, picks, teams, rounds });
  }

  const results: BoardResult[] = [];
  for (const [boardIndex, board] of completeBoards.entries()) {
    const bundle = buildAggregateBundle({
      scoring: "std",
      teams: board.teams,
      rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1, BENCH: 6 },
    });
    const currentPlayers = bundleToSimPlayers(bundle);
    const players = mergeBoardPlayers(currentPlayers, board.picks);
    const config = createDefaultSimDraftConfig({
      draftId: `evaluation-${boardIndex}`,
      teams: board.teams,
      rounds: board.rounds,
      userSlot: 1,
      seed: `evaluation-${boardIndex}`,
    });
    let state = createSimDraft(config);
    const strategyMetrics: Record<SimBotStrategyId, number[]> = {
      "sleeper-adp-needs": [],
      "sleeper-market-v1": [],
    };

    for (const rawPick of board.picks) {
      const context = getBotStrategyContext(state, players, rawPick.draft_slot);
      for (const strategyId of SIM_BOT_STRATEGY_IDS) {
        const rank = rankSimBotPlayers(strategyId, context).findIndex(
          (player) => player.player_id === rawPick.player_id
        );
        strategyMetrics[strategyId].push(
          rank >= 0 ? rank + 1 : context.available.length + 1
        );
      }
      state = {
        ...state,
        status: rawPick.pick_no === board.picks.length ? "complete" : "drafting",
        picks: DraftPicksSchema.parse([...state.picks, rawPick]),
      };
    }
    results.push({
      file: board.file,
      split: boardIndex % 4 === 0 ? "holdout" : "calibration",
      strategies: summarizeStrategies(strategyMetrics),
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    boardCount: results.length,
    methodology: "Every fourth complete board is held out. Metrics rank each actual Sleeper pick among strategy choices using only prior picks.",
    calibration: aggregate(results.filter((result) => result.split === "calibration")),
    holdout: aggregate(results.filter((result) => result.split === "holdout")),
    boards: results,
  };
  const output = "data/draft-results/sleeper-strategy-evaluation.json";
  await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ output, ...summary }, null, 2));
}

function mergeBoardPlayers(
  current: readonly SimDraftPlayer[],
  picks: readonly z.infer<typeof RawPickSchema>[]
) {
  const byId = new Map(current.map((player) => [player.player_id, player]));
  for (const pick of picks) {
    if (byId.has(pick.player_id)) continue;
    const name = `${pick.metadata.first_name} ${pick.metadata.last_name}`.trim();
    byId.set(pick.player_id, {
      player_id: pick.player_id,
      name: name || pick.metadata.team || pick.player_id,
      position: pick.metadata.position,
      team: pick.metadata.team || null,
      bye_week: null,
      rank: null,
      tier: null,
    });
  }
  return [...byId.values()];
}

function summarizeRanks(ranks: readonly number[]) {
  const sorted = [...ranks].sort((a, b) => a - b);
  return {
    samples: ranks.length,
    meanRank: ranks.length ? round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length) : null,
    medianRank: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    top1Pct: percent(ranks, 1),
    top3Pct: percent(ranks, 3),
    top10Pct: percent(ranks, 10),
  };
}

type RankSummary = ReturnType<typeof summarizeRanks>;
type BoardResult = {
  file: string;
  split: "holdout" | "calibration";
  strategies: Record<SimBotStrategyId, RankSummary>;
};

function summarizeStrategies(metrics: Record<SimBotStrategyId, number[]>) {
  return {
    "sleeper-adp-needs": summarizeRanks(metrics["sleeper-adp-needs"]),
    "sleeper-market-v1": summarizeRanks(metrics["sleeper-market-v1"]),
  };
}

function aggregate(results: BoardResult[]) {
  return Object.fromEntries(
    SIM_BOT_STRATEGY_IDS.map((id) => {
      const metrics = results.map((result) => result.strategies[id]).filter(Boolean);
      const total = metrics.reduce((sum, metric) => sum + metric.samples, 0);
      const weighted = (key: "top1Pct" | "top3Pct" | "top10Pct" | "meanRank") =>
        total
          ? round(metrics.reduce((sum, metric) => sum + (metric[key] ?? 0) * metric.samples, 0) / total)
          : null;
      return [id, { samples: total, meanRank: weighted("meanRank"), top1Pct: weighted("top1Pct"), top3Pct: weighted("top3Pct"), top10Pct: weighted("top10Pct") }];
    })
  );
}

function percent(ranks: readonly number[], ceiling: number) {
  return ranks.length ? round((ranks.filter((rank) => rank <= ceiling).length / ranks.length) * 100) : null;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
