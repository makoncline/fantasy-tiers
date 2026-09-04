import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { glob } from "glob";

import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { rankingScoringFromRules } from "../../src/lib/draftLeagueConfig";
import { buildDraftViewModel } from "../../src/lib/draftState";
import { draftReadinessShardCountsFromBundle } from "../../src/lib/draftReadiness";
import type { DraftResultArtifact } from "../../src/lib/draftResults";
import { DraftPicksSchema } from "../../src/lib/schemas";
import { resolveVerifiedSleeperReplayInput } from "../../src/lib/sleeperBoardReplay";

void main();

async function main() {
  const files = (
    await glob("data/draft-results/**/sleeper-picks.json", { nodir: true })
  ).sort();
  const boards = [];
  const skipped = [];

  for (const file of files) {
    const siblingArtifactPath = path.join(path.dirname(file), "draft-result.json");
    const resolution = resolveVerifiedSleeperReplayInput({
      rawPicks: await readJson(file),
      artifact: await readOptionalJson(siblingArtifactPath),
      configSource: siblingArtifactPath,
    });
    if (resolution.status === "skipped") {
      skipped.push({ file, code: resolution.code, reason: resolution.reason });
      console.log(`${path.basename(path.dirname(file))}: skipped (${resolution.code})`);
      continue;
    }

    const artifact = resolution.artifact;
    const config = artifact.state.config;
    const bundle = buildAggregateBundle({
      scoring: rankingScoringFromRules(config.scoringRules),
      teams: config.teams,
      rosterSlots: config.rosterSlots,
    });
    const allPlayersMap = draftCandidateMapFromBundle(bundle);
    const pickedPlayerIds = new Set(
      artifact.sleeper.picks.map((pick) => pick.player_id)
    );
    const playersMap = Object.fromEntries(
      Object.entries(allPlayersMap).filter(([, player]) =>
        (player.fp_rank_ave != null && player.fp_rank_ave <= 350) ||
        player.position === "K" ||
        player.position === "DEF" ||
        pickedPlayerIds.has(player.player_id)
      )
    );
    const replay = replayDraft({ artifact, bundle, playersMap });
    boards.push({
      file,
      configSource: resolution.configSource,
      config: {
        teams: config.teams,
        rounds: config.rounds,
        userSlot: config.userSlot,
        draftType: config.draftType,
        rosterSlots: config.rosterSlots,
        scoringRules: config.scoringRules,
      },
      replay,
    });
    console.log(
      `${path.basename(path.dirname(file))}: ` +
      `${config.rounds} user picks replayed with the canonical draft model`
    );
  }

  const output = "data/draft-results/sleeper-board-replay.json";
  const report = {
    generatedAt: new Date().toISOString(),
    methodology:
      "Historical opportunity and timing replay with current rankings. This is not an independent outcome grade.",
    includedBoardCount: boards.length,
    skippedBoardCount: skipped.length,
    boards,
    skipped,
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    output,
    includedBoardCount: report.includedBoardCount,
    skippedBoardCount: report.skippedBoardCount,
  }, null, 2));
}

function replayDraft(input: {
  artifact: DraftResultArtifact;
  bundle: ReturnType<typeof buildAggregateBundle>;
  playersMap: ReturnType<typeof draftCandidateMapFromBundle>;
}) {
  const config = input.artifact.state.config;
  const decisions = input.artifact.sleeper.picks
    .filter((pick) => pick.draft_slot === config.userSlot)
    .map((actualPick) => {
      const priorPicks = DraftPicksSchema.parse(
        input.artifact.sleeper.picks.filter(
          (pick) => pick.pick_no < actualPick.pick_no
        )
      );
      const viewModel = buildDraftViewModel({
        playersMap: input.playersMap,
        draft: input.artifact.sleeper.draftDetails,
        picks: priorPicks,
        userId: config.userId,
        scoringRules: config.scoringRules,
        projectionArtifact: input.bundle.draftProjections,
        sourceHealth: input.bundle.sourceHealth ?? null,
        shardCounts: draftReadinessShardCountsFromBundle(input.bundle),
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
      return {
        pickNo: actualPick.pick_no,
        round: actualPick.round,
        actualPlayerId: actualPick.player_id,
        actualPlayer:
          input.playersMap[actualPick.player_id]?.name ?? actualPick.player_id,
        actualRecommendationRank:
          actualRank == null || actualRank < 0 ? null : actualRank + 1,
        actualScore: actualMetric?.recommendationScore ?? null,
        recommendedPlayerId: recommendation?.player_id ?? null,
        recommendedPlayer: recommendation?.name ?? null,
        recommendedScore: recommendedMetric?.recommendationScore ?? null,
        scoreGap:
          actualMetric && recommendedMetric
            ? round(
                recommendedMetric.recommendationScore -
                actualMetric.recommendationScore
              )
            : null,
      };
    });
  const draftValueStatus = buildDraftViewModel({
    playersMap: input.playersMap,
    draft: input.artifact.sleeper.draftDetails,
    picks: [],
    userId: config.userId,
    scoringRules: config.scoringRules,
    projectionArtifact: input.bundle.draftProjections,
    sourceHealth: input.bundle.sourceHealth ?? null,
    shardCounts: draftReadinessShardCountsFromBundle(input.bundle),
  }).draftValueStatus;

  return {
    available: draftValueStatus.available,
    unavailableReason: draftValueStatus.reason,
    decisions,
    topChoiceMatches: decisions.filter(
      (decision) => decision.actualRecommendationRank === 1
    ).length,
    topThreeMatches: decisions.filter(
      (decision) =>
        decision.actualRecommendationRank != null &&
        decision.actualRecommendationRank <= 3
    ).length,
  };
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

function round(value: number) {
  return Math.round(value * 10) / 10;
}
