import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { DraftResultArtifactSchema } from "../../src/lib/draftResults";
import { AggregatesBundleResponse } from "../../src/lib/schemas-bundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { draftReadinessShardCountsFromBundle } from "../../src/lib/draftReadiness";
import { buildDraftViewModel } from "../../src/lib/draftState";
import { buildDraftValueBoard } from "../../src/lib/draftValue";
import { PositionEnum } from "../../src/lib/schemas";

async function main() {
  const root = "data/draft-results/choice-assistant-release/stress";
  const stored = z.object({ artifact: z.string(), bundlePath: z.string(), report: z.object({ scenarios: z.array(z.object({ leanId: z.string().nullable(), adjustedGap: z.number().nullable() })) }) })
    .parse(JSON.parse(await readFile(join(root, "slot-10-pick-58.json"), "utf8")));
  const artifact = DraftResultArtifactSchema.parse(JSON.parse(await readFile(stored.artifact, "utf8")));
  const bundle = AggregatesBundleResponse.parse(JSON.parse(await readFile(stored.bundlePath, "utf8")));
  const config = artifact.state.config;
  const view = buildDraftViewModel({
    draft: { ...artifact.sleeper.draftDetails, status: "paused" },
    picks: artifact.sleeper.picks.filter((p) => p.pick_no < 58),
    playersMap: draftCandidateMapFromBundle(bundle), userId: config.userId,
    scoringRules: config.scoringRules, projectionArtifact: bundle.draftProjections,
    sourceHealth: bundle.sourceHealth ?? null, shardCounts: draftReadinessShardCountsFromBundle(bundle),
    evaluationNow: new Date(artifact.exportedAt),
  });
  if (!view.choiceSnapshot || !view.recommendationBoard) throw new Error("Saved board is not ready");
  const input = view.choiceSnapshot.boardInput;
  const replacements = new Map<string, { ecr: number; value: number; partner: string }>();
  for (const position of PositionEnum.options) {
    const players = input.players.filter((p) => p.position === position && p.fp_rank_ave != null && input.staticValuesByPlayerId[p.player_id] != null)
      .sort((a,b) => a.fp_rank_ave! - b.fp_rank_ave! || a.player_id.localeCompare(b.player_id));
    for (let i=1;i+1<players.length;i+=2) {
      const a=players[i]!,b=players[i+1]!;
      replacements.set(a.player_id,{ecr:b.fp_rank_ave!,value:input.staticValuesByPlayerId[b.player_id]!,partner:b.name});
      replacements.set(b.player_id,{ecr:a.fp_rank_ave!,value:input.staticValuesByPlayerId[a.player_id]!,partner:a.name});
    }
  }
  const after = buildDraftValueBoard({ ...input,
    players: input.players.map((p) => replacements.has(p.player_id) ? {...p,fp_rank_ave:replacements.get(p.player_id)!.ecr} : p),
    staticValuesByPlayerId: {...input.staticValuesByPlayerId,...Object.fromEntries([...replacements].map(([id,v])=>[id,v.value]))},
  });
  if (after.topRecommendation?.player.player_id !== stored.report.scenarios[1]?.leanId || after.topRecommendation?.metrics.recommendationScoreGap !== stored.report.scenarios[1]?.adjustedGap) throw new Error("Trace differs from saved scenario");
  const ids = new Set([view.recommendationBoard.topRecommendation!.player.player_id, after.topRecommendation!.player.player_id]);
  const trace = [...ids].map((id) => ({ player: input.players.find((p)=>p.player_id===id), swap: replacements.get(id),
    before: view.recommendationBoard!.metricsByPlayerId[id], after: after.metricsByPlayerId[id], valueInputs: view.choiceSnapshot!.values.valuesByPlayerId[id] }));
  await writeFile("data/draft-results/ac-final-verification/slot-10-trace.json", JSON.stringify({ priorPicks:input.currentPick-1, counts:input.userPositionCounts,needs:input.userPositionNeeds,trace, afterTop: after.recommendations.slice(0, 3).map((p) => ({ name: p.name, metrics: after.metricsByPlayerId[p.player_id] })) },null,2));
  console.log(JSON.stringify(trace.map((t)=>({name:t.player?.name,ecr:t.player?.fp_rank_ave,swap:t.swap,before:t.before?.components,after:t.after?.components,reasonsBefore:t.before?.reasons,reasonsAfter:t.after?.reasons})),null,2));
}
main().catch((e)=>{console.error(e);process.exitCode=1;});
