import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DraftCandidateSchema } from "../../src/lib/draftCandidate";
import { buildDraftValueBoard } from "../../src/lib/draftValue";
import { selectPositionPolicy } from "./position-quality-policy";
const Counts = z.object({ QB:z.number().default(0),RB:z.number().default(0),WR:z.number().default(0),TE:z.number().default(0),K:z.number().default(0),DEF:z.number().default(0),FLEX:z.number().default(0),BN:z.number().default(0) });
const Player = DraftCandidateSchema.extend({ drafted:z.boolean().optional(),draftedByMe:z.boolean().optional(),picked:z.union([z.boolean(),z.object({overall:z.number().nullable().optional()})]).nullable().optional() });
const Components = z.object({value:z.number(),timing:z.number(),starterNeed:z.number(),construction:z.number(),onesie:z.number(),depth:z.number(),demand:z.number(),risk:z.number()});
const View = z.object({ choiceSnapshot:z.object({ boardInput:z.object({players:z.array(Player),teams:z.number(),rounds:z.number(),draftType:z.string(),currentPick:z.number(),userSlot:z.number(),rosterRequirements:Counts,userPositionCounts:Counts,userPositionNeeds:Counts,draftWideNeeds:Counts,teamRosterStates:z.array(z.object({draftSlot:z.number(),positionCounts:Counts,starterNeeds:Counts,benchSlotsRemaining:z.number()})),userRosterPlayers:z.array(Player),irSlots:z.number(),staticValuesByPlayerId:z.record(z.string(),z.number())})}),recommendationBoard:z.object({topRecommendation:z.object({player:Player}),metricsByPlayerId:z.record(z.string(),z.object({recommendationScore:z.number(),components:Components}))}) });
const Response = z.object({sourceViews:z.object({fp:View,sleeper:View})});
const root=process.argv[2]!;
const reports=[];
for(const folder of ['actual-draft-20260907','fresh-context-classic-20260907']) {
 for(const file of fs.readdirSync(path.join(root,folder)).filter(f=>f.startsWith('source-'))) {
  const response=Response.parse(JSON.parse(fs.readFileSync(path.join(root,folder,file),'utf8')));
  for(const source of ['fp','sleeper'] as const) {
   const view=response.sourceViews[source];const board=buildDraftValueBoard(view.choiceSnapshot.boardInput);
   let maxDelta=0;
   for(const p of board.recommendations) {
    const actual=board.metricsByPlayerId[p.player_id]!;const saved=view.recommendationBoard.metricsByPlayerId[p.player_id]!;
    for(const key of Object.keys(Components.shape)) {
     const component=Components.keyof().parse(key);
     maxDelta=Math.max(maxDelta,Math.abs(actual.components[component]-saved.components[component]));
    }
   }
   const match=board.topRecommendation?.player.player_id===view.recommendationBoard.topRecommendation.player.player_id;
   reports.push({folder,file,source,pick:view.choiceSnapshot.boardInput.currentPick,match,maxDelta,
    guard:selectPositionPolicy(board,'quality-guard')?.name,baseline:board.topRecommendation?.player.name});
  }
 }
}
fs.writeFileSync(path.join(root,'replay-verification.json'),JSON.stringify(reports,null,2));
console.log(JSON.stringify({boards:reports.length,matching:reports.filter(r=>r.match&&r.maxDelta<1e-9).length,changed:reports.filter(r=>r.guard!==r.baseline)},null,2));
if(reports.some(r=>!r.match||r.maxDelta>=1e-9)) process.exitCode=1;
