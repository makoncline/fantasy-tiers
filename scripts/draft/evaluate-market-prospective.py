"""Evaluate the frozen 12-board prospective batch without owner-adherence filtering."""
import argparse
import json
import statistics as st
from collections import defaultdict
from pathlib import Path
from experiment_statistics import paired_interval
import math


def score(rows, model):
    pairs = [(r[model], r['observed']) for r in rows if r[model] is not None]
    if not pairs:
        return {'count': 0}
    return dict(count=len(pairs), brier=st.mean((p-y)**2 for p,y in pairs), logLoss=st.mean(-math.log(max(1e-12, min(1-1e-12, p if y else 1-p))) for p,y in pairs), meanPrediction=st.mean(p for p,y in pairs), observedSurvival=st.mean(y for p,y in pairs))


def evaluate(root):
    results = [json.loads(p.read_text()) for p in sorted(root.glob('*/predictions.json'))]
    if len(results) != 12 or sorted(r['manifest']['config']['userSlot'] for r in results) != list(range(1,13)):
        raise ValueError('Need twelve new complete boards across all twelve slots.')
    if len({r['manifest']['draftId'] for r in results}) != 12 or len({json.dumps(r['manifest']['freeze'], sort_keys=True) for r in results}) != 1:
        raise ValueError('Boards must be unique and use one frozen candidate.')
    rows = [row for result in results for row in result['rows']]
    turns = [turn for result in results for turn in result['turns']]
    if len(turns) != 156 or any(not t['evidenceValid'] for t in turns):
        raise ValueError('Every prospective boundary must be valid.')
    groups = defaultdict(list)
    for row in rows:
        wait = '0-3' if row['distance'] <= 3 else '4-7' if row['distance'] <= 7 else '8-12' if row['distance'] <= 12 else '13+'
        phase = 'early' if row['round'] <= 4 else 'middle' if row['round'] <= 9 else 'late'
        for cohort in ('broad','decision'):
            if not row[cohort]:
                continue
            for key in ('all',f'position:{row["position"]}',f'wait:{wait}',f'phase:{phase}'):
                groups[f'{cohort}/{key}'].append(row)
    summaries = {}
    for key, cohort in groups.items():
        paired = [r for r in cohort if r['current'] is not None]
        summaries[key] = {'candidateAll': score(cohort,'candidate'), 'pairedCandidate': score(paired,'candidate'), 'pairedCurrent': score(paired,'current'), 'currentCoverage':len(paired)/len(cohort), 'calibration': {model:[score([r for r in cohort if r[model] is not None and min(9,int(r[model]*10)) == b],model) for b in range(10)] for model in ('candidate','current')}}
    offense = [r for r in rows if r['decision'] and r['position'] != 'DEF']
    paired = [r for r in offense if r['current'] is not None]
    deltas = [st.mean((r['candidate']-r['observed'])**2-(r['current']-r['observed'])**2 for r in paired if r['board']==b['manifest']['draftId']) for b in results]
    interval = paired_interval(deltas)
    defense_bias = st.mean(t['expectedPositionPicks']['DEF']-t['observedPositionPicks']['DEF'] for t in turns)
    exposure = {(t['board'],t['pickNo']):t['observedPositionPicks']['DEF']>0 for t in turns}
    defense_strata = {}
    for present in (False,True):
        cohort = [r for r in paired if exposure[(r['board'],r['pickNo'])]==present]
        defense_strata[str(present)] = {'candidate':score(cohort,'candidate'),'current':score(cohort,'current'), 'brierDelta':st.mean((r['candidate']-r['observed'])**2-(r['current']-r['observed'])**2 for r in cohort) if cohort else None}
    off_score = score(offense,'candidate')
    criteria = dict(validBoards=True, commonCoverage=len(paired)/len(offense)>=.95, eightSlotsImprove=sum(d<0 for d in deltas)>=8, pairedIntervalBelowZero=interval['bootstrap95'][1]<0, offenseCalibrationGap=abs(off_score['meanPrediction']-off_score['observedSurvival'])<=.10, defenseCountBias=abs(defense_bias)<=.5, defenseExposureNoLargeRegression=all(v['brierDelta'] is not None and v['brierDelta']<=.03 for v in defense_strata.values()))
    decision = 'accept limited offensive preview' if all(criteria.values()) else 'reject limited use' if interval['bootstrap95'][0]>0 else 'retain as experimental'
    positional = defaultdict(list)
    for result in results:
        for g in result['groups']:
            positional[g['position']].append(g)
    group_scores = {pos:dict(atLeastOne=score(gs,'atLeastOne'),remainingCountMAE=st.mean(abs(g['expectedRemaining']-g['observedRemaining']) for g in gs)) for pos,gs in positional.items()}
    return dict(decision=decision, criteria=criteria, boards=12, forecasts=len(turns), observations=len(rows), ownerAdherence=dict(followed=sum(t['ownerFollowedDefault'] is True for t in turns),different=sum(t['ownerFollowedDefault'] is False for t in turns),unknown=sum(t['ownerFollowedDefault'] is None for t in turns)), offensiveDecisionPaired=interval, slotDeltas=[dict(slot=r['manifest']['config']['userSlot'],delta=d) for r,d in zip(results,deltas)], cohortReports=summaries, positionalGroups=group_scores, defenseCountMeanError=defense_bias, defenseExposure=defense_strata, positionPickCounts={pos:dict(predicted=sum(t['expectedPositionPicks'][pos] for t in turns),observed=sum(t['observedPositionPicks'][pos] for t in turns)) for pos in ('QB','RB','WR','TE','DEF')}, limitations=['Sleeper bots only; not human drafts.','A PPR label is not verification of the complete scoring map.','Whole-board resampling describes this batch; twelve slots are a coverage budget.','No selection-policy or fantasy-outcome claim.'])


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);args=parser.parse_args()
    report=evaluate(args.root)
    (args.root/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('decision','criteria','boards','forecasts','observations','ownerAdherence','offensiveDecisionPaired','defenseCountMeanError')},indent=2))
