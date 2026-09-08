import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DraftCandidateSchema } from "../../src/lib/draftCandidate";
import { DraftPicksSchema } from "../../src/lib/schemas";
import { createMockDraftResultArtifact, DraftResultArtifactSchema } from "../../src/lib/draftResults";
import { evaluateDraftQuality, evaluateCoreStarterEcr } from "../../src/lib/draftEvaluation";
import { getSimDraftSnapshot, toSleeperDraftDetails, type SimDraftPlayer, type SimDraftState } from "../../src/lib/simDraft";
const [inputPath, output] = process.argv.slice(2);
if (!inputPath || !output) throw new Error("Usage: evaluate-position-quality.ts FROZEN_PREFLIGHT OUTPUT_DIR");
const input = z.object({ sourceViews: z.object({ fp: z.object({ choiceSnapshot: z.object({ boardInput: z.object({ players: z.array(DraftCandidateSchema) }) }) }) }) }).parse(JSON.parse(fs.readFileSync(inputPath, "utf8")));
const players: SimDraftPlayer[] = input.sourceViews.fp.choiceSnapshot.boardInput.players.map(p => ({ ...p, rank: p.rank ?? 9999, tier: p.tier ?? 9999, sleeperAdp: p.sleeper_adp, sleeperRank: p.sleeper_board_rank }));
const Run = z.object({ config: DraftResultArtifactSchema.shape.state.shape.config, picks: DraftPicksSchema });
const evaluations = [];
for (const file of fs.readdirSync(output).filter(f => /^\d+-\d+-.*\.json$/.test(f))) {
  const run = Run.parse(JSON.parse(fs.readFileSync(path.join(output,file),"utf8")));
  const state: SimDraftState = { config: run.config, picks: run.picks, events: [], status: "complete" };
  const artifact = createMockDraftResultArtifact({ state, snapshot: getSimDraftSnapshot(state, players), players,
    draftDetails: toSleeperDraftDetails(state), draftPicks: run.picks,
    notes: ["Offline policy experiment. Source hash and full changed-pick traces are in the companion run file."] });
  evaluations.push({ file, quality: evaluateDraftQuality(artifact), ecr: evaluateCoreStarterEcr(artifact) });
}
fs.writeFileSync(path.join(output,"quality-evaluation.json"),JSON.stringify(evaluations,null,2));
console.log(JSON.stringify({runs:evaluations.length,mandatoryPass:evaluations.filter(e=>e.quality.mandatoryPass).length}));
