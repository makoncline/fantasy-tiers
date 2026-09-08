# Real draft replay with selected-source ADJ

The selected-source change is committed as `08b9b7fb` on
`codex/selected-source-position-order`. No merge or production deployment was performed.

## Inputs and method

Use the frozen pre-draft snapshot from September 7 and all 180 verified final
picks. Exact league settings: 12 teams, snake slot 4, 15 rounds, 0.69 PPR,
QB1/RB2/WR2/TE1/FLEX2/K1/DEF1, bench5. Inputs are frozen: no later news or
ranking refresh is included.

Two distinct replay modes run for each selected source:

- Actual board: each decision uses only the original picks before that turn,
  including the owner's original earlier selections. This tests recommendations
  against the actual opportunities. It does not build a new roster.
- Counterfactual: the owner takes the new top recommendation. Opponents take
  their original player when available. If unavailable, they take the highest
  remaining same-position player by the frozen Sleeper board rank, then ADP
  where a board rank is absent. This is an explicit opponent assumption, not
  a claim about how the real owners would react. Later observed picks are not
  used to rank replacement players.

The saved `sleeper-picks.json` has only 176 picks. Use `final-picks.json`, which
has all 180. Travis Hunter at pick 175 is not in the frozen offensive candidate
pool (Sleeper labels him DB). His original pick is retained. It occurs after
the owner's final pick at 172 and cannot affect any recommendation. The script
fails if an unmatched player occurs before the final owner turn.

## Results

FP matches 8 of 15 actual selections in both modes. Its recommendations happen
to be identical between the actual-board and counterfactual runs. The first
change is pick 52, McLaurin instead of Jameson Williams.
Sleeper matches 4 of 15 actual selections in each mode; the matching count does
not mean that its two replay paths are identical.

The FP counterfactual needs 10 opponent substitutions. Sleeper needs 19.
Both counterfactuals produce complete 15-player owner rosters with one QB and
one TE. All four runs have 180 sequential, unique player selections. Every
recommendation was available before its decision. The actual roster is not
rewritten during actual-board evaluation.

## Actual picks versus counterfactual picks

| Pick | Actual | New FP | New Sleeper |
| ---: | --- | --- | --- |
| 4 | jonathan taylor | jonathan taylor | puka nacua |
| 21 | drake london | drake london | jonathan taylor |
| 28 | trey mcbride | trey mcbride | trey mcbride |
| 45 | cam skattebo | cam skattebo | dandre swift |
| 52 | jameson williams | terry mclaurin | terry mclaurin |
| 69 | drake maye | drake maye | drake maye |
| 76 | tony pollard | tony pollard | brian thomas |
| 93 | chris godwin | chris godwin | tony pollard |
| 100 | kyle monangai | kenny gainwell | jayden reed |
| 117 | jakobi meyers | josh downs | kyle monangai |
| 124 | deebo samuel | jalen coker | jalen coker |
| 141 | khalil shakir | khalil shakir | khalil shakir |
| 148 | dylan sampson | jonah coleman | tyrone tracy |
| 165 | wil lutz | kaimi fairbairn | kaimi fairbairn |
| 172 | baltimore ravens | new england patriots | baltimore ravens |

## Forecast comparison

These are full-season projections for the best legal starting lineup, including
two FLEX slots. They are not expected head-to-head season scores or proof of
improvement. Both native sources use the exact league scoring.

| Roster | FP starters + FLEX | Sleeper starters + FLEX | FP bench | Sleeper bench |
| --- | ---: | ---: | ---: | ---: |
| actual | 2026.92 | 1876.06 | 697.82 | 665.53 |
| newFP | 2023.87 | 1889.32 | 599.93 | 645.12 |
| newSleeper | 2077.15 | 2005.84 | 649.4 | 699.67 |

## Reproduce

```
node --import=tsx scripts/draft/replay-real-draft.ts \
  data/draft-results/post-draft-20260908/actual-draft-20260907/preflight-view-model.json \
  data/draft-results/post-draft-20260908/actual-draft-20260907/final-picks.json \
  data/draft-results/post-draft-20260908/real-draft-new-system
```

Saved JSON includes selected source, input hash, all decisions and score
components, position leaders, opponent replacements, full picks, and final
rosters. This is an offline replay, not a rendered mock-room or live polling test.
