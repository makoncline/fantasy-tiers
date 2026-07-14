import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { glob } from "glob";

import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { buildDraftViewModel } from "../../src/lib/draftState";
import { DraftPicksSchema } from "../../src/lib/schemas";
import {
  importSleeperDraftBoard,
  RawSleeperDraftBoardSchema,
} from "../../src/lib/sleeperDraftImport";

void main();

async function main() {
  const files = (
    await glob("data/draft-results/**/sleeper-picks.json", { nodir: true })
  ).sort();
  const bundle = buildAggregateBundle({
    scoring: "std",
    teams: 10,
    rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1, BENCH: 6 },
  });
  const allPlayersMap = draftCandidateMapFromBundle(bundle);
  const relevantPlayersMap = Object.fromEntries(
    Object.entries(allPlayersMap).filter(([, player]) =>
      (player.fp_rank_ave != null && player.fp_rank_ave <= 350) ||
      player.position === "K" ||
      player.position === "DEF"
    )
  );
  const boards = [];

  for (const file of files) {
    const raw = RawSleeperDraftBoardSchema.parse(
      JSON.parse(await readFile(file, "utf8"))
    );
    const userSlot = Number(path.dirname(file).match(/slot-?(\d+)/)?.[1]);
    if (!Number.isInteger(userSlot) || raw.length === 0) continue;
    const artifact = importSleeperDraftBoard(raw, {
      userSlot,
      scoring: "std",
      leagueName: `Replay ${path.basename(path.dirname(file))}`,
    });
    const playersMap = {
      ...relevantPlayersMap,
      ...Object.fromEntries(
        artifact.sleeper.picks.flatMap((pick) => {
          const player = allPlayersMap[pick.player_id];
          return player ? [[pick.player_id, player]] : [];
        })
      ),
    };
    const decisions = [];
    for (const actualPick of artifact.sleeper.picks.filter(
      (pick) => pick.draft_slot === userSlot
    )) {
      const priorPicks = DraftPicksSchema.parse(
        artifact.sleeper.picks.filter((pick) => pick.pick_no < actualPick.pick_no)
      );
      const viewModel = buildDraftViewModel({
        playersMap,
        draft: artifact.sleeper.draftDetails,
        picks: priorPicks,
        userId: artifact.state.config.userId,
      });
      const board = viewModel.recommendationBoard;
      const recommendation = board?.topRecommendation?.player ?? null;
      const actualRank = board?.recommendations.findIndex(
        (player) => player.player_id === actualPick.player_id
      );
      const actualMetric = board?.metricsByPlayerId[actualPick.player_id];
      const recommendedMetric = recommendation
        ? board?.metricsByPlayerId[recommendation.player_id]
        : null;
      decisions.push({
        pickNo: actualPick.pick_no,
        round: actualPick.round,
        actualPlayerId: actualPick.player_id,
        actualPlayer: playersMap[actualPick.player_id]?.name ?? actualPick.player_id,
        actualRecommendationRank: actualRank == null || actualRank < 0 ? null : actualRank + 1,
        actualScore: actualMetric?.recommendationScore ?? null,
        recommendedPlayerId: recommendation?.player_id ?? null,
        recommendedPlayer: recommendation?.name ?? null,
        recommendedScore: recommendedMetric?.recommendationScore ?? null,
        scoreGap:
          actualMetric && recommendedMetric
            ? Math.round((recommendedMetric.recommendationScore - actualMetric.recommendationScore) * 10) / 10
            : null,
      });
    }
    boards.push({
      file,
      userSlot,
      decisions,
      topChoiceMatches: decisions.filter((decision) => decision.actualRecommendationRank === 1).length,
      topThreeMatches: decisions.filter(
        (decision) => decision.actualRecommendationRank != null && decision.actualRecommendationRank <= 3
      ).length,
    });
    console.log(`${path.basename(path.dirname(file))}: ${decisions.length} user picks replayed`);
  }

  const output = "data/draft-results/sleeper-board-replay.json";
  const report = {
    generatedAt: new Date().toISOString(),
    methodology:
      "Replays each saved user pick with only earlier picks visible. Uses current rankings because historical source snapshots were not saved with these boards.",
    boardCount: boards.length,
    decisionCount: boards.reduce((sum, board) => sum + board.decisions.length, 0),
    boards,
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, boardCount: report.boardCount, decisionCount: report.decisionCount }, null, 2));
}
