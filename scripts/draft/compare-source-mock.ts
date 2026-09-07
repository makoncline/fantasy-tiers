import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildAggregateBundle } from "../../src/lib/aggregateBundle";
import { draftCandidateMapFromBundle } from "../../src/lib/draftCandidate";
import { buildDraftViewModel } from "../../src/lib/draftState";
import { draftReadinessShardCountsFromBundle } from "../../src/lib/draftReadiness";
import { DEFAULT_DRAFT_ROSTER_SLOTS, DEFAULT_DRAFT_SCORING_RULES } from "../../src/lib/draftLeagueConfig";
import { compareDraftSources, ProjectionSourceSchema } from "../../src/lib/draftSourceComparison";
import { choiceRosterFit } from "../../src/lib/draftChoices";
import { advanceUntilUserTurn, bundleToSimPlayers, createDefaultSimDraftConfig, createSimDraft, getSimDraftSnapshot, makeUserPick, toSleeperDraftDetails, toSleeperDraftPicks } from "../../src/lib/simDraft";

const output = path.resolve(process.argv[2] ?? "data/draft-results/source-comparison-2026-09-07");
fs.mkdirSync(output, {recursive:true});
const bundle = buildAggregateBundle({scoring:"half",teams:12,rosterSlots:DEFAULT_DRAFT_ROSTER_SLOTS});
const fp = ProjectionSourceSchema.parse(JSON.parse(fs.readFileSync("public/data/aggregate/fantasypros-draft-projections.json","utf8")));
const players = bundleToSimPlayers(bundle);
const ids = new Set(players.map(p=>p.player_id));
const playersMap = Object.fromEntries(Object.entries(draftCandidateMapFromBundle(bundle)).filter(([id])=>ids.has(id)));
const now = new Date();
const common = {userId:"source-review",teams:12,userSlot:4,season:"2026",seed:"source-review-2026-09-07-slot4",scoringRules:DEFAULT_DRAFT_SCORING_RULES,rosterSlots:DEFAULT_DRAFT_ROSTER_SLOTS,botStrategy:"sleeper-market-v1" as const};
fs.writeFileSync(path.join(output,"frozen-inputs.json"),JSON.stringify({bundle,fp,common,evaluationNow:now.toISOString()}));
const hash=createHash("sha256").update(JSON.stringify({bundle,fp,common})).digest("hex");
const runs=[];
for (const policy of ["current","sleeper","fp"] as const) {
  const config=createDefaultSimDraftConfig({...common,draftId:`sim-source-review-${policy}`});
  let state=advanceUntilUserTurn(createSimDraft(config),players);
  const decisions=[];
  while(state.status!=="complete") {
    const turn=getSimDraftSnapshot(state,players);
    if(!turn.isUserTurn) throw new Error("Expected own turn");
    const vm=buildDraftViewModel({valueSource:"combined",playersMap,draft:toSleeperDraftDetails(state),picks:toSleeperDraftPicks(state),userId:config.userId,scoringRules:config.scoringRules,projectionArtifact:bundle.draftProjections,sourceHealth:bundle.sourceHealth??null,shardCounts:draftReadinessShardCountsFromBundle(bundle),evaluationNow:now});
    if(!vm.choiceSnapshot || !vm.recommendationBoard) throw new Error(`Readiness failed at ${turn.currentPickNo}: ${JSON.stringify(vm.readiness?.incidents)}`);
    const snapshot=vm.choiceSnapshot;
    const comparison=compareDraftSources(snapshot,fp,now.getTime());
    if(!comparison.fp) throw new Error(comparison.problems.join(" "));
    const boards={current:vm.recommendationBoard,sleeper:comparison.sleeper.board,fp:comparison.fp.board};
    const current=boards.current.topRecommendation;
    if(!current) throw new Error("No current recommendation");
    const specialist=["K","DEF"].includes(current.player.position);
    const selected = policy==='fp' && specialist ? current : boards[policy].topRecommendation;
    if(!selected || selected.metrics.staticValue==null) throw new Error(`No usable ${policy} choice at ${turn.currentPickNo}`);
    const candidateIds=new Set(Object.values(boards).flatMap(b=>b.topRecommendation ? [b.topRecommendation.player.player_id]:[]));
    const alternatives=[...candidateIds].map(id=>{
      const player=playersMap[id]!;
      return {id,name:player.name,position:player.position,rosterFit:choiceRosterFit(player,snapshot.boardInput.userPositionNeeds),scores:Object.fromEntries(Object.entries(boards).map(([source,board])=>{
        const m=board.metricsByPlayerId[id];const value=source==='current'?snapshot.values.valuesByPlayerId[id]:source==='sleeper'?comparison.sleeper.values.valuesByPlayerId[id]:comparison.fp!.values.valuesByPlayerId[id];
        return [source,m&&m.staticValue!=null ? {val:m.staticValue,adj:m.recommendationScore,points:value?.projectedPoints,components:m.components,explanation:m.recommendationExplanation,rank:board.recommendations.findIndex(p=>p.player_id===id)+1}:null];
      }))};
    });
    const leaders=Object.fromEntries(Object.entries(boards).map(([source,board])=>{
      const top=board.topRecommendation;
      if(source==='fp'&&specialist) return [source,{sharedSpecialist:true,id:current.player.player_id,name:current.player.name,position:current.player.position,val:null,adj:null}];
      return [source,top?{id:top.player.player_id,name:top.player.name,position:top.player.position,val:top.metrics.staticValue,adj:top.metrics.recommendationScore}:null];
    }));
    decisions.push({round:decisions.length+1,pick:turn.currentPickNo,leaders,selected:{id:selected.player.player_id,name:selected.player.name,position:selected.player.position},before:{needs:snapshot.boardInput.userPositionNeeds,counts:snapshot.boardInput.userPositionCounts,roster:snapshot.boardInput.userRosterPlayers},alternatives,sourceCoverage:{matched:comparison.coverage,total:comparison.total},snapshot});
    state=advanceUntilUserTurn(makeUserPick(state,selected.player.player_id,players),players);
  }
  const picks=toSleeperDraftPicks(state);
  const roster=picks.filter(p=>p.draft_slot===4).map(p=>({id:p.player_id,name:playersMap[p.player_id]?.name,position:playersMap[p.player_id]?.position}));
  const run={policy,hash,config,decisions,roster,picks};
  fs.writeFileSync(path.join(output,`${policy}.json`),JSON.stringify(run,null,2));
  runs.push({policy,roster,decisions:decisions.map(({snapshot,...decision})=>decision)});
  console.log(policy,roster.map(p=>`${p.name} (${p.position})`).join(', '));
}
fs.writeFileSync(path.join(output,"summary.json"),JSON.stringify({hash,runs},null,2));
