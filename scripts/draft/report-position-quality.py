"""Pair completed policy drafts by seed and slot. No significance or outcome claim."""
import json
import sys
from pathlib import Path
from statistics import mean

root = Path(sys.argv[1])
runs, qualities = [], {}
for folder in ['paired', 'position-timing']:
    batch = json.loads((root/folder/'summary.json').read_text())
    for run in batch['summaries']:
        run['folder'] = folder
        runs.append(run)
    for q in json.loads((root/folder/'quality-evaluation.json').read_text()):
        qualities[(folder,q['file'])] = q
assert len(runs)==195
assert len({r['hash'] for r in runs})==1
baseline = {(r['slot'],r['seed']):r for r in runs if r['policy']=='baseline'}
def quality(run):
    return qualities[(run['folder'],f"{run['slot']}-{run['seed']}-{run['policy']}.json")]
def load(run):
    return json.loads((root/run['folder']/f"{run['slot']}-{run['seed']}-{run['policy']}.json").read_text())
def summary(policy, only_slot4=False):
    group=[r for r in runs if r['policy']==policy and (not only_slot4 or r['slot']==4)]
    pairs=[(r,baseline[(r['slot'],r['seed'])]) for r in group]
    scores={}
    for source in ['fp','sleeper']:
        scores[source]={}
        for metric in ['starters','flex','depth','positiveValueDepth']:
            deltas=[r[source][metric]-b[source][metric] for r,b in pairs if r[source][metric] is not None and b[source][metric] is not None and not r[source]['missingProjectionIds'] and not b[source]['missingProjectionIds']]
            scores[source][metric]=dict(evaluablePairs=len(deltas),missingPairs=len(pairs)-len(deltas),mean=mean(deltas) if deltas else None,minimum=min(deltas) if deltas else None,maximum=max(deltas) if deltas else None,
                worse=sum(d<0 for d in deltas),same=sum(d==0 for d in deltas),better=sum(d>0 for d in deltas))
    traces=[]
    for r,b in pairs:
        for actual,base in zip(load(r)['decisions'],load(b)['decisions']):
            if actual['selected']['id']!=base['selected']['id']:
                traces.append(dict(slot=r['slot'],seed=r['seed'],pick=actual['pick'],
                    baseline=base['selected']['name'],selected=actual['selected']['name'],
                    valDifference=actual['selected']['staticValue']-base['selected']['staticValue'],
                    tierDifference=actual['selected']['tier']-base['selected']['tier'],
                    riskDifference=actual['selected']['components']['risk']-base['selected']['components']['risk'],
                    baselineComponents=base['selected']['components'],selectedComponents=actual['selected']['components']))
    return dict(policy=policy,cases=len(group),legal=sum(r['legal'] for r in group),
        mandatoryPass=sum(quality(r)['quality']['mandatoryPass'] for r in group),
        ownerPolicy=sum(r['ownerPolicy'] for r in group),
        coreConstructionPass=sum(quality(r)['quality']['coreConstructionPass'] for r in group),
        ecrScoreMeanDelta=mean(quality(r)['ecr']['score']-quality(b)['ecr']['score'] for r,b in pairs),
        scores=scores,changedPicks=len(traces),sameStateInterventions=sum(r['changes'] for r in group),
        sameStateValSacrificed=sum(r['valSacrificed'] for r in group),traces=traces)
policies=['baseline','quality-guard','highest-value','tier-first','position-timing']
report=dict(hash=runs[0]['hash'],allSlots=[summary(p) for p in policies],slot4=[summary(p,True) for p in policies])
(root/'paired-report.json').write_text(json.dumps(report,indent=2))
compact={k:[{key:value for key,value in r.items() if key!='traces'} for r in report[k]] for k in ['allSlots','slot4']}
compact['hash']=report['hash']
Path('docs/post-draft-position-quality-results.json').write_text(json.dumps(compact,indent=2))
for scope in ['allSlots','slot4']:
 print(scope)
 for r in report[scope]:
  print(r['policy'],'legal',r['legal'],'mandatory',r['mandatoryPass'],'changes',r['changedPicks'],
        'FP',[round(r['scores']['fp'][m]['mean'],2) if r['scores']['fp'][m]['mean'] is not None else None for m in ['starters','flex','depth']],
        'Sleeper',[round(r['scores']['sleeper'][m]['mean'],2) if r['scores']['sleeper'][m]['mean'] is not None else None for m in ['starters','flex','depth']],
        'VAL sacrificed',round(r['sameStateValSacrificed'],2),'ECR delta',round(r['ecrScoreMeanDelta'],2))
