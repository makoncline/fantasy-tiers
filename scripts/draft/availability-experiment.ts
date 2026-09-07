import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

import { DraftDecisionLogSchema } from "../../src/lib/draftDecisionLog";
import { DraftResultArtifactSchema } from "../../src/lib/draftResults";
import { type SimDraftPlayer } from "../../src/lib/simDraft";
import { predictAvailability } from "./availability-model";

const BatchSchema = z.object({
  runs: z.array(z.object({
    run: z.number().int().positive(),
    slot: z.number().int().positive(),
    draftResultPath: z.string(),
    decisionsPath: z.string(),
  })).min(1),
});

// This is an offline prediction experiment. It does not rank our draft choices.
async function main() {
  const [batchPath, output] = process.argv.slice(2);
  if (!batchPath || !output) throw new Error("Usage: availability-experiment.ts BATCH OUTPUT");
  const batch = BatchSchema.parse(JSON.parse(await readFile(batchPath, "utf8")));
  const samples = 32;
  const rows = [];
  const inputs = [];

  // One held-out seed from each slot. No parameter fitting uses these boards.
  for (const run of batch.runs.filter((run) => run.run === 1)) {
    const artifact = DraftResultArtifactSchema.parse(JSON.parse(await readFile(run.draftResultPath, "utf8")));
    const log = DraftDecisionLogSchema.parse(JSON.parse(await readFile(run.decisionsPath, "utf8")));
    if (artifact.summary.status !== "complete") throw new Error("A complete board is required.");
    const config = artifact.state.config;
    const players: SimDraftPlayer[] = artifact.players.all.map((player) => ({
      player_id: player.player_id, name: player.name, position: player.position,
      team: player.team, bye_week: player.bye_week, rank: player.rank, tier: player.tier,
      sleeperAdp: player.sleeperAdp ?? null, sleeperRank: player.sleeperRank ?? null,
      sleeper_adp: player.sleeper_adp ?? null,
    }));
    inputs.push({ path: run.draftResultPath, sourceSnapshot: log.sourceSnapshot });
    for (let turn = 0; turn < log.decisions.length - 1; turn += 1) {
      const decision = log.decisions[turn]!;
      const next = log.decisions[turn + 1]!;
      const priorPicks = artifact.sleeper.picks.filter((pick) => pick.pick_no <= decision.pickNo);
      const actualOwnPick = priorPicks.find((pick) => pick.pick_no === decision.pickNo);
      if (actualOwnPick?.player_id !== decision.selected.playerId) throw new Error("Decision and board do not match.");
      const candidates = decision.topOptions.filter((p) => p.playerId !== decision.selected.playerId && p.comebackProbability != null);
      const probabilities = predictAvailability({ draft: artifact.sleeper.draftDetails,
        picks: priorPicks.filter((pick) => pick.pick_no < decision.pickNo), selectedId: decision.selected.playerId,
        nextPick: next.pickNo, players, candidateIds: candidates.map((p) => p.playerId), samples, seed: config.seed });
      const actualGone = new Set(artifact.sleeper.picks.filter((pick) => decision.pickNo < pick.pick_no && pick.pick_no < next.pickNo).map((pick) => pick.player_id));
      for (const candidate of candidates) {
        const prediction = probabilities[candidate.playerId]!;
        const distance = next.pickNo - decision.pickNo - 1;
        rows.push({ board: config.seed, slot: config.userSlot, pickNo: decision.pickNo, round: decision.round,
          playerId: candidate.playerId, position: candidate.position, distance,
          observed: Number(!actualGone.has(candidate.playerId)),
          current: candidate.comebackProbability, ...prediction });
      }
    }
    console.log(`Completed availability screen for slot ${config.userSlot}`);
  }
  await writeFile(output, JSON.stringify({
    method: "Offline 32-sample platform/roster availability screen on the first held-out seed per slot. Both use the existing market bot's top-ten choice distribution and phase rules. Platform mode removes roster needs. Roster mode allows backups. Simulation seeds differ from the actual draft seeds. This is synthetic mechanism evidence, not live calibration or independent roster outcome evidence.",
    samples, inputs, rows,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
