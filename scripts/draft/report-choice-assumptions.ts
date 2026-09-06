import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { DraftResultArtifactSchema } from "../../src/lib/draftResults";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { draftReadinessShardCountsFromBundle } from "../../src/lib/draftReadiness";
import { buildDraftViewModel } from "../../src/lib/draftState";
import { buildDraftChoices } from "../../src/lib/draftChoices";
import { analyzeDraftChoiceSensitivity } from "../../src/lib/draftChoiceSensitivity";

const Batch = z.object({ runs: z.array(z.object({ run: z.number(), slot: z.number(), draftResultPath: z.string() })) });
async function main() {
const [batchFile, outDir] = process.argv.slice(2);
if (!batchFile || !outDir) throw new Error("Use report-choice-assumptions.ts BATCH-SUMMARY OUTPUT-DIR");
const batch = Batch.parse(JSON.parse(await readFile(batchFile, "utf8")));
await mkdir(outDir, { recursive: true });
const records = [];
// Fixed coverage: the first seed, all slots, rounds 1/5/8/final. This is a
// diagnostic sample, not a forecast probability sample or an outcome holdout.
for (const run of batch.runs.filter((r) => r.run === 1)) {
  const raw = await readFile(run.draftResultPath, "utf8");
  const artifact = DraftResultArtifactSchema.parse(JSON.parse(raw));
  const config = artifact.state.config;
  const bundle = buildAggregateBundle({ scoring: config.scoring, teams: config.teams, rosterSlots: config.rosterSlots });
  const bundlePath = path.join(outDir, `bundle-slot-${run.slot}.json`);
  await writeFile(bundlePath, JSON.stringify(bundle));
  for (const pick of artifact.sleeper.picks.filter((p) => p.draft_slot === config.userSlot && [1, 5, 8, config.rounds].includes(p.round))) {
    const view = buildDraftViewModel({
      playersMap: draftCandidateMapFromBundle(bundle),
      draft: { ...artifact.sleeper.draftDetails, status: "paused" },
      picks: artifact.sleeper.picks.filter((p) => p.pick_no < pick.pick_no),
      userId: config.userId,
      scoringRules: config.scoringRules,
      projectionArtifact: bundle.draftProjections,
      sourceHealth: bundle.sourceHealth ?? null,
      shardCounts: draftReadinessShardCountsFromBundle(bundle),
    });
    if (!view.choiceSnapshot || !view.recommendationBoard) throw new Error(`Board not ready at ${run.slot}/${pick.pick_no}`);
    const choices = buildDraftChoices(view.recommendationBoard);
    const report = analyzeDraftChoiceSensitivity(view.choiceSnapshot);
    const record = {
      slot: run.slot, pick: pick.pick_no, round: pick.round,
      artifact: run.draftResultPath,
      artifactSha256: createHash("sha256").update(raw).digest("hex"),
      bundlePath, choices, report,
    };
    await writeFile(path.join(outDir, `slot-${run.slot}-pick-${pick.pick_no}.json`), JSON.stringify(record, null, 2));
    records.push({ slot: run.slot, pick: pick.pick_no, round: pick.round, lean: choices[0]?.player.name, report });
  }
  console.log(`Saved slot ${run.slot} stress reports.`);
}
await writeFile(path.join(outDir, "summary.json"), JSON.stringify({
  method: "First seed across all slots; rounds 1, 5, 8, and final. Six hand-set stress cases. No outcome or confidence claim.",
  testedDecisions: records.length,
  stableSets: records.filter((r) => r.report.status === "Stable under tested assumptions").length,
  changedSets: records.filter((r) => r.report.status === "Choice changes with assumptions").length,
  differentPaths: records.filter((r) => r.report.scenarios.some((s) => s.change === "Different roster path")).length,
  records,
}, null, 2));

}
main().catch((error) => { console.error(error); process.exitCode = 1; });
