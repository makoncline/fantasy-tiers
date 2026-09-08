"""Audit frozen responses. Saved board numbers and components remain authoritative."""
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
rows, reversals, actual = [], [], []
for folder in ['actual-draft-20260907', 'fresh-context-classic-20260907']:
    files = []
    for path in (root / folder).glob('source-*.json'):
        response = json.loads(path.read_text())
        view = response['sourceViews']['fp']
        if not view.get('recommendationBoard') or not view.get('choiceSnapshot'):
            continue
        files.append((view['choiceSnapshot']['boardInput']['currentPick'], path, response))
    previous = None
    for pick, path, response in sorted(files):
        view = response['sourceViews']['fp']
        board = view['recommendationBoard']
        lead = board['topRecommendation']['player']
        metrics = board['metricsByPlayerId']
        lm = metrics[lead['player_id']]
        pool = [p for p in board['recommendations'] if p['position'] == lead['position']]
        def describe(p):
            m = metrics[p['player_id']]
            return dict(id=p['player_id'], name=p['name'], position=p['position'], tier=m['positionTier'],
                        val=m['staticValue'], adj=m['recommendationScore'], components=m['components'],
                        availability=m['availability'])
        valued = [p for p in pool if metrics[p['player_id']]['staticValue'] is not None]
        highest = max(valued, key=lambda p: metrics[p['player_id']]['staticValue'])
        strict = min(valued, key=lambda p: (metrics[p['player_id']]['positionTier'] or float('inf'), -metrics[p['player_id']]['staticValue']))
        def conflict(p):
            m = metrics[p['player_id']]
            return (m['staticValue'] > lm['staticValue'] and m['positionTier'] and lm['positionTier'] and
                    m['positionTier'] <= lm['positionTier'] and
                    m['availability']['classification'] != 'unknown' and lm['availability']['classification'] != 'unknown' and
                    m['availability']['penalty'] <= lm['availability']['penalty'] and m['components']['risk'] >= lm['components']['risk'])
        conflicts = sorted(filter(conflict, valued), key=lambda p: -metrics[p['player_id']]['staticValue'])
        rows.append(dict(folder=folder, file=path.name, pick=pick, onOwnerTurn=(pick-1)%24 in [3,20],
                         projectionUpdatedAt=view['choiceSnapshot']['projectionUpdatedAt'],
                         scoring=view['choiceSnapshot']['scoringRules'], lead=describe(lead), highest=describe(highest),
                         strictTier=describe(strict), conflicts=[describe(p) for p in conflicts]))
        if previous:
            prior_pick, prior = previous
            pm = prior['metricsByPlayerId']
            old_ids = {p['player_id'] for p in prior['recommendations']}
            # Only pairs that stay eligible and available in both saved responses.
            eligible = [p for p in board['recommendations'] if p['player_id'] in old_ids]
            for i, a in enumerate(eligible):
                for b in eligible[i+1:]:
                    if a['position'] != b['position']: continue
                    aid, bid = a['player_id'], b['player_id']
                    old = pm[aid]['recommendationScore'] - pm[bid]['recommendationScore']
                    new = metrics[aid]['recommendationScore'] - metrics[bid]['recommendationScore']
                    if old * new >= 0: continue
                    changes = {k: (metrics[aid]['components'][k]-metrics[bid]['components'][k]) -
                               (pm[aid]['components'][k]-pm[bid]['components'][k]) for k in lm['components']}
                    reversals.append(dict(folder=folder, beforePick=prior_pick, afterPick=pick,
                        a=describe(a), b=describe(b), beforeGap=old, afterGap=new,
                        componentGapChanges=changes, valGap=metrics[aid]['staticValue']-metrics[bid]['staticValue']))
        previous = pick, board
picks = json.loads((root/'actual-draft-20260907/final-picks.json').read_text())
assert len(picks)==180 and sorted(p['pick_no'] for p in picks)==list(range(1,181))
assert len({p['player_id'] for p in picks})==180
for p in picks:
    if p['draft_slot']==4:
        matches=[r for r in rows if r['folder']=='actual-draft-20260907' and r['pick']==p['pick_no']]
        actual.append(dict(pick=p['pick_no'], playerId=p['player_id'], metadata=p.get('metadata'),
            exactSavedLead=matches[0]['lead'] if matches else None,
            adviceTiming='See frozen live-notes.md; exact returned board does not prove advice was timely'))
report=dict(rows=rows,reversals=reversals,actual=actual,
    limits='Snapshots are selected, dependent, and irregularly spaced. Changes can include owner picks and phase changes, not only opponent picks. No alternate outcome claim.')
(root/'saved-state-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(dict(states=len(rows),reversals=len(reversals),ownerPicks=len(actual),
    conflicts=[{'file':r['file'],'pick':r['pick'],'lead':r['lead']['name'],'alternatives':[p['name'] for p in r['conflicts']]} for r in rows if r['conflicts']]),indent=2))
