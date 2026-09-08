# Boris Chen tier experiment — 2026-09-08

The method is feasible. It changes many tier labels but few recommendations under the current selected-source policy. There is no clear evidence that it makes better teams. Production is unchanged.

## Method

- Baseline: current contiguous 1D k-means tiers.
- Candidate: Boris Chen's `Mclust(Avg.Rank, G=k)` operation, including empty-label compression and the overall 3-group split followed by 10/8/8 subgroups.
- Source: [ff-functions.R](https://github.com/borisachen/fftiers/blob/3b5f00b59bccd3ffbc82a893126efe378d0be132/src/ff-functions.R#L141) and [main.R](https://github.com/borisachen/fftiers/blob/3b5f00b59bccd3ffbc82a893126efe378d0be132/src/main.R#L74), pinned at `3b5f00b59bccd3ffbc82a893126efe378d0be132`.
- Runtime: native R 4.6.1 and mclust 6.1.3. This reproduces the method with current package versions, not a claim to reproduce every tier on his live website.
- App baseline: `8de9d3b4818ad35c0b637f782c4e5c2d4be6ba05`.
- Frozen September 7 published rankings and projections. Reconstructed baseline tiers matched every published player within all 13 tested table limits. Source hashes and input copies are saved beside this report.
- Only overall tier and position tier fields change. Player identities, ECR, ADP, projections, VAL, risk rules, selected-source ordering, and baseline bot pool remain fixed. Players beyond each original table limit retain the same overflow policy: last tier plus one.
- Both variants use the shared recommendation board. No production algorithm or UI file changed. FLEX tier output is compared for display; recommendations use overall and individual position tiers.

## Draft design

144 matched pairs, 288 full local simulations. Each combination runs all 12 slots with three fixed seeds. Both use 12-team snake drafts and the existing `sleeper-market-v1` bots.

- `half-two-flex`: 0.69 PPR; QB/RB/WR/TE/K/DEF = 1/2/2/1/1/1; 2 FLEX, 5 bench, 0 IR; 15 rounds. Uses half-PPR ranking shards.
- `ppr-one-flex`: 1 PPR; same position starters; 1 FLEX, 7 bench, 0 IR; 16 rounds.
- Other scoring uses `DEFAULT_DRAFT_SCORING_RULES`, including standard reference kicker and defense scoring. These are reference configurations, not a replay of the exact live ESPN league scoring.
- Each runs with FP and Sleeper selected separately. Evaluation time is fixed at `2026-09-08T06:00:00Z`.
- At each user turn, both methods are evaluated against the same board state. Each draft then takes its own method's top recommendation. This separates direct recommendation changes from later draft-path changes.

## Draft results

All 288 passed the shared mandatory, legal-roster, endgame, and core-construction gates. All met the one-QB/one-TE owner policy. Every roster player had projections in both sources.

| Reference format | Selected source | Changed top picks on baseline paths | Changed rosters | Mean FP projected starter-point change |
|---|---|---:|---:|---:|
| half-two-flex | fp | 0/540 | 0/36 | +0.00 |
| ppr-one-flex | fp | 1/576 | 1/36 | +1.37 |
| half-two-flex | sleeper | 1/540 | 1/36 | +0.00 |
| ppr-one-flex | sleeper | 5/576 | 5/36 | +0.18 |

There were 7 changed top picks across 2,232 baseline-path decisions (0.31%). In FP mode, there was 1 change across 1,116 decisions. Tier changes can affect timing/cliff bonuses and position-tier rules, but they do not replace the selected-source ordering constraint.

### Concrete changed pick

PPR, FP selected, slot 4, seed 1, pick 4:

- Current: Christian McCaffrey, ADJ 182.8; Puka Nacua, 182.6.
- Boris: Puka Nacua, ADJ 183.2; McCaffrey, 182.8.
- Nacua's timing component increased from 6.2 to 6.8. The tier change moved a close decision by 0.6 ADJ. His projections and VAL did not change.
- The different first pick changed the later roster. The final starter projection increased by 49.17 season points under FP and 19.20 under Sleeper. This is one synthetic draft path, not evidence of better realized performance.

In the PPR Sleeper runs, starter forecasts improved in two pairs, fell in two, and stayed equal in 32. The ranges were -19.31 to +21.85 FP season points and -17.90 to +22.00 Sleeper season points. The half-PPR Sleeper change was a bench swap from Jalen Coker to Jakobi Meyers; starter totals did not change.

The shared core-starter ECR diagnostic was unchanged in both half-PPR groups. Mean summed ECR rose from 236.93 to 237.21 in PPR/FP and from 251.45 to 252.50 in PPR/Sleeper (lower is better). Thus the small projection gains were not a uniform improvement across diagnostics. ECR and both projection sources are internal measures, not independent outcome evidence.

## Tier changes

Counts compare players within the original table limit. Changed numeric labels can reflect merged earlier groups, not a new relative judgment about every player.

| Table | Scoring | Changed tier labels | Occupied tiers: current → Boris |
|---|---|---:|---:|
| QB | std | 7/26 | 8 → 7 |
| RB | ppr | 4/40 | 10 → 9 |
| WR | ppr | 48/60 | 12 → 9 |
| TE | ppr | 16/25 | 8 → 7 |
| K | std | 12/20 | 5 → 4 |
| DEF | std | 2/20 | 6 → 5 |
| FLEX | ppr | 10/95 | 14 → 14 |
| ALL | ppr | 29/200 | 26 → 26 |
| RB | half | 6/40 | 9 → 8 |
| WR | half | 10/60 | 10 → 9 |
| TE | half | 23/25 | 7 → 5 |
| FLEX | half | 8/95 | 15 → 15 |
| ALL | half | 119/200 | 26 → 23 |

Gaussian mixtures can have components with no assigned players. Boris's code compresses those empty labels. For example, PPR WR has 9 occupied tiers versus our 12. This is a real method difference.

Unlike our contiguous split, Boris's output is not always monotonic in the displayed `rank_ecr` order. It clusters `rank_ave`, which can differ from that order. The PPR overall table had 12 adjacent decreases in tier number; half-PPR had 17. A production option would need clear display semantics for this.

### The four players from your screenshots

In PPR, both methods produce the same overall/position tiers:

| Player | Overall tier | Position tier |
|---|---:|---:|
| D'Andre Swift | 8 | RB 5 |
| Cam Skattebo | 9 | RB 5 |
| DeVonta Smith | 4 | WR 3 |
| Zay Flowers | 5 | WR 3 |

Changing tier methods alone does not remove the ECR-order behavior you asked about. A surrounding pool can still affect scarcity bonuses, so this is a comparison of their tier fields, not a replay of your screenshot's exact roster state.

## Validation and limits

- 288 completed paired-run simulations; full application/adapter board-metric equality checked at each run's first user pick. Projection values were equal between methods.
- Eight additional smoke runs checked full application/adapter equality at the first and final two user turns. Their rosters and summaries exactly matched the corresponding full runs.
- The shared saved-draft evaluator passed all four quality gates for all 288 runs.
- TypeScript check and explicit lint of the three experiment TypeScript scripts passed.
- No live ESPN room was used in this experiment. No independent season outcome or Footballguys grade was claimed. One frozen date and one bot model do not establish general superiority.

## Decision

Boris's method is a reasonable candidate if its grouping is preferred. This test does not justify switching production for draft quality. Review its visual grouping next, especially the non-monotonic tier labels, before considering a production option. Keep the ranking-order policy separate from the tier-method decision.

## Reproduce

From the application checkout at the recorded baseline, restore `published/*.json` into `public/data/aggregate/` in a separate checkout. Use the saved experiment scripts. Install `mclust` 6.1.3 and `jsonlite` in a local R library; no application dependency is required.

```sh
node --import=tsx scripts/tiers/prepare-boris-experiment.ts OUTPUT_DIR
Rscript scripts/tiers/boris-mclust.R OUTPUT_DIR/tier-inputs.json OUTPUT_DIR/boris-tiers.json R_LIBRARY_DIR
node --import=tsx scripts/tiers/test-boris-drafts.ts OUTPUT_DIR
node --import=tsx scripts/tiers/evaluate-boris-drafts.ts OUTPUT_DIR
```

Artifacts include each draft's full picks, roster, paired recommendation log, source bundles, source hashes, clustering fit metadata, and the upstream source files. Experiment scripts are saved as `.ts.txt` source snapshots in the ignored experiment artifact directory. Copy them into `scripts/tiers/` with `.ts` extensions at the recorded baseline to reproduce the experiment.
