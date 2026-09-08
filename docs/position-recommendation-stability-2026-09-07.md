# Position recommendation stability

Tested the current local ADJ rule across 78 complete, fixed-input drafts:
39 FP mode and 39 Sleeper mode. Twelve slots, three seeds each, plus three
extra slot-4 seeds. This covers 1,170 owner turns. It does not test browser
polling or source refreshes during an actual draft.

For each position, compare its first eligible canonical recommendation with
that position's leader at the previous owner turn. Check whether the old player
was drafted before classifying the transition. A position can leave the eligible
recommendation pool under roster or endgame rules; this is not a player switch.

| Selected source | Old leader still available | Same leader | Switched player | Position no longer eligible |
| --- | ---: | ---: | ---: | ---: |
| FP | 501 | 478 | 3 | 20 |
| Sleeper | 526 | 508 | 5 | 13 |

Seven switches involve different existing risk components. The remaining switch
is between players with an equal Sleeper source rank. No switch with equal risk
and unequal source rank was found in these runs. This is a sample result, not a
proof across all possible draft states.

| Source | Slot/seed | Pick | Previous leader | New leader | Current risk components, previous / new |
| --- | --- | ---: | --- | --- | --- |
| fp | 11/2 | 62 | luther burden | christian watson | -3 / 0 |
| fp | 9/2 | 129 | jordan mason | rachaad white | 0 / -3.2 |
| fp | 9/3 | 105 | jonathon brooks | kenny gainwell | -3.2 / 0 |
| sleeper | 1/1 | 73 | george kittle | travis kelce | -3 / 0 |
| sleeper | 1/3 | 73 | george kittle | travis kelce | -3 / 0 |
| sleeper | 10/2 | 82 | treveyon henderson | jaylen warren | -3 / 0 |
| sleeper | 12/1 | 61 | tetairoa mcmillan | jaylen waddle | 0 / 0 |
| sleeper | 4/6 | 76 | kyle pitts | tucker kraft | 0 / -3 |

Example: at picks 60 to 61, slot 12 / seed 1 in Sleeper mode changes from
Tetairoa McMillan to Jaylen Waddle. Both have 197.13 projected points and share
source rank WR21. Waddle's timing component is 10.4 versus McMillan's 10.1,
so Waddle leads 130.5 to 130.2 ADJ. Neither has a risk penalty.

In slot 1 / seed 1, Kittle leads TE at pick 72. At pick 73, he remains eligible
but scores 24.7 after a -3 risk component; Kelce scores 27 with zero risk.
The source data did not change. Existing risk can reverse a close score gap as
draft context changes; a new injury report is not required.

All 78 complete pick sequences match the earlier saved runs exactly. All retain
legal rosters. Six focused scoring/source tests and TypeScript checks pass.
Only offline measurement and documentation changed in this check.

Reproduce with `position-quality-experiment.ts` using the frozen preflight,
`canonical` or `canonical-sleeper`, and output folders `position-stability-fp`
and `position-stability-sleeper`. Then run:

```
python3 scripts/draft/report-position-stability.py data/draft-results/post-draft-20260908
```

Full per-turn leaders, previous leaders at the current turn, availability,
components, and the compact report are stored under that ignored result folder.
