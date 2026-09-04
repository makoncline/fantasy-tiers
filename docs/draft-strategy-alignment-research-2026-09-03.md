# Draft Strategy Alignment Research

Last verified: 2026-09-03

## Decision Summary

The proposed strategy is sound with three limits:

1. Use FantasyPros ECR as a player-quality signal and Sleeper ADP as a room-price signal. Do not treat either one as the final pick order.
2. Treat an elite QB or TE as an opportunity only when the player is at a market discount and the RB/WR opportunity cost is small.
3. Do not add a general bonus for a player on a winning NFL team. Team scoring, role, volume, and game script are closer to fantasy production and can move different positions in opposite directions.

For 0.69 PPR, interpolation of projected fantasy points is methodologically sound. Interpolation of rank numbers is not.

## What Sleeper Anchors In The Draft Room

Sleeper says its draftboard gives all managers context from the full board, recent opponent picks, position runs, and players who can be gone before the next turn. Its current mock-draft page also says its board exposes opponent moves and team needs, and that mocks can use custom ADP. These are shared market anchors, not private information. [Sleeper draftboard guide](https://sleeper.com/blog/how-to-do-a-mock-draft-with-the-sleeper-draftboard/) [Sleeper mock drafts](https://sleeper.com/mockdraft)

Sleeper defines platform ADP as the average pick from mock and real drafts across its users. It says the data can differ by scoring and draft format. Sleeper also warns that ADP is an average, can contain CPU picks, changes over time, and is not a measure of the 32nd-best player when the ADP is 32. [Sleeper ADP guide](https://sleeper.com/blog/what-does-adp-mean-in-fantasy-football/)

The queue is another important anchor. A manager can reorder it. If the clock expires, Sleeper first uses that queue. When the queue is empty, Sleeper says auto-pick uses roster need and a higher-ranked available player. This behavior can increase demand near the top of Sleeper's list and at open starter positions. [Sleeper queue guide](https://support.sleeper.com/en/articles/3989685-watch-list-vs-draft-queue)

The documented API gives the assistant the selected league's scoring settings and roster positions. The draft endpoints give the draft type, team count, roster slots, rounds, timer, draft order, current status, and all prior picks. Pick metadata includes the player's team, position, status, and injury status. [Sleeper API](https://docs.sleeper.com/)

Sleeper's public documentation does not define the exact default sort of the 2026 football player table or promise that its internal projection endpoint is stable. The app must inspect the live room before the real draft and record the actual displayed order and columns. Do not infer the UI order only from an API query parameter.

### Practical edge over a Sleeper-only manager

- Find players whose FantasyPros quality rank is better than their Sleeper ADP. This gap can identify a player whom the room sees too late.
- Buy the player near the Sleeper price. Do not immediately select at the FantasyPros rank if the player has a good chance to return.
- Use the next user pick, current position runs, open roster spots, and same-tier alternatives to estimate return. This is the VONA decision, not a fixed ADP rule.
- Detect room drift. If the league is taking QBs, TEs, or one NFL team earlier than Sleeper ADP, update the return estimate from actual picks.
- Show both signals. `Val` should explain player quality. `Adj` should explain roster fit, next-turn loss, room demand, and market discount.

This is an information advantage, not a reason to be contrarian by default. A large ECR-versus-Sleeper gap can also mean stale news, an injury, or a format mismatch. Require fresh sources and show the reason for the gap.

## FantasyPros ECR, ADP, And Value

FantasyPros defines ECR as a consensus made from rank points assigned to each expert's ordered list. It explicitly does not use a simple average rank. Thus, an ECR rank is ordinal. The difference between ranks 10 and 20 is not a defined quantity equal to the difference between ranks 40 and 50. [FantasyPros ECR method](https://support.fantasypros.com/hc/en-us/articles/115001219327-What-is-ECR-Expert-Consensus-Rankings-and-how-do-you-calculate-it)

FantasyPros defines ADP as Average Draft Position. It defines value-based drafting as incremental value against opponent rosters, not simply the highest projected points. Its VORP uses projected points over a replacement player. Its VONA compares the current choice with what the model expects to be available at the user's next pick. [FantasyPros terminology](https://support.fantasypros.com/hc/en-us/articles/115001316147-FantasyPros-Terminology-and-Acronyms) [FantasyPros VBD method](https://support.fantasypros.com/hc/en-us/articles/115005868747-What-is-value-based-drafting-What-do-player-draft-values-mean-VORP-VONA-VOLS-VBD)

This supports the intended decision order:

1. Start from the highest player quality.
2. Compare close players at positions the roster needs.
3. Compare the loss at the next turn.
4. Take a QB or TE only when its positional advantage exceeds the RB/WR value that is given up.

## Exact 0.69 PPR Handling

Do not interpolate half-PPR and PPR **rank numbers**. ECR ranks are ordinal and come from separate expert lists. Rank interpolation can create a number with no FantasyPros-defined meaning.

Interpolate **projected fantasy points** from one common projection set. When reception points are the only changed rule, fantasy points are linear in the reception coefficient:

```text
points(0.69) = points(0.50) + 0.38 * (points(1.00) - points(0.50))
             = non-reception points + 0.69 * projected receptions
```

The factor is `0.38` because `(0.69 - 0.50) / (1.00 - 0.50) = 0.38`.

After this calculation, sort all players again and recalculate positional replacement value and next-turn value. Do not only blend two finished ranks. FantasyPros describes the same general method for custom leagues: create player projections, apply the league's scoring, and then update rankings and tools. [FantasyPros custom-scoring method](https://support.fantasypros.com/hc/en-us/articles/360039535653-How-do-enhanced-rankings-and-tools-work-with-my-custom-scoring-i-e-non-default-settings-league) [FantasyPros draft custom scoring](https://support.fantasypros.com/hc/en-us/articles/115003497468-Do-player-suggestions-and-opponent-draft-selections-adjust-based-on-my-custom-scoring-settings)

For this app, keep FantasyPros ECR visible as the source `Val`. Add the capability-checked 0.69 scoring effect to `Adj` only when one current projection set has valid receptions and the other required stats. Label the adjustment as projection-based. This preserves the meaning of ECR and avoids false precision when projections are missing.

## NFL Team Quality

Do not use projected NFL wins as a general player bonus.

The direction is not stable by position. A team that leads often can improve an RB's carry and touchdown environment. A team that trails often can increase pass volume for its QB, WRs, and TEs. Sleeper describes both effects: it linked Derrick Henry's move to a stronger team with more favorable rushing game scripts, and it says trailing teams can give QBs, WRs, and TEs more volume. [Sleeper offseason analysis](https://sleeper.com/blog/nfl-offseason-fantasy-report-2024/) [Sleeper game-script guidance](https://sleeper.com/blog/nfl-dfs-strategy/)

NFL wins can also disagree with fantasy output. Sleeper documented an RB9 on a struggling Carolina team and warned about fantasy risk on an undefeated Kansas City team. Those examples are not a causal study, but they show why a monotonic win bonus is unsafe. [Sleeper schedule analysis](https://sleeper.com/blog/teams-players-best-fantasy-football-playoff-schedules-2024/)

Use these inputs instead, in this order:

1. Player projections and ECR, which should already include expected role and offense.
2. Projected touches, targets, routes, and goal-line role.
3. Team implied points or scoring environment when it adds information not present in the projection.
4. Projected wins only as an explained tiebreaker between otherwise close players.

A separate win bonus can double-count the same offense information that ECR and projections already contain. If the app adds a team-context signal later, validate it out of sample and by position.

## Recommended Product Rule

The recommendation engine should use this sequence:

1. Remove unavailable, ineligible, and materially injured players.
2. Build a short set from the best current `Val` players.
3. Apply starter needs, FLEX needs, and RB/WR balance to close choices.
4. Apply the capability-checked custom-scoring adjustment when valid projections exist.
5. Apply next-turn loss and the Sleeper market discount.
6. Allow an elite QB or TE only when it is not a reach against ECR or Sleeper ADP and it does not pass a clearly better RB/WR.
7. Use team environment and bye coverage as late tiebreakers. Do not weaken an early starting lineup to solve a bye week.
8. Reserve D/ST and kicker for the endgame, except for a small and explicit elite D/ST exception.

## Required Validation Before A Strategy Change

- Capture the live Sleeper player table, default sort, visible projections, ADP, bye, injury, and queue behavior shortly before the real draft.
- Replay the same fixed seeds with PPR mapping and capability-checked 0.69 projection scoring.
- Report changed picks, RB/WR opportunity cost, QB/TE reach against both ECR and Sleeper ADP, and whole-roster quality.
- Accept the scoring change only if the target metric improves without reducing the whole-roster regression result. No active evaluator provides an independent outcome grade.

## Addendum: BEER And BEER+ Reproducibility

### Published facts

Subvertadown defines BEER as its name for a man-games baseline. The method estimates the number of players at each position that active fantasy rosters need across a season. It then uses historical games played to find the player cutoff that can supply that demand. The public guide gives examples of player availability, such as about 15 games for a leading QB and about 13 games for a leading RB. It does not publish the current position cutoffs or the full historical input table. [Subvertadown baseline guide](https://subvertadown.com/article/guide-to-understanding-the-different-baselines-in-value-based-drafting-vbd-vols-vs-vorp-vs-man-games-and-beer-)

The same guide says that BEER+ starts from BEER and moves some bench value to starters by mixing BEER and VOLS. It publishes this VOLS weight:

```text
VOLS weight = VOLS relevant-player count
              / (BEER relevant-player count + VOLS relevant-player count)
```

The guide gives an approximate example of 40% VOLS and 60% BEER, but it says that the mix depends on roster composition. Therefore, `0.40` is not a universal published constant. The guide describes the result as a weighted sum, but it does not publish a complete executable equation or define every input edge case. [Subvertadown baseline guide](https://subvertadown.com/article/guide-to-understanding-the-different-baselines-in-value-based-drafting-vbd-vols-vs-vorp-vs-man-games-and-beer-)

Current BEER+ is more than the baseline mix. Subvertadown lists five parts: positional ECR alignment, dual baselines, QB streaming, ADP referencing, and risk-adjusted valuation. The risk work uses 10 years of preseason projections, actual results, replacement production, variance fits, and Sharpe ratios. The public article gives study reference ranks of QB16, RB40, WR48, and TE20. These are risk-study replacement ranks. They are not published BEER man-games cutoffs. The article does not publish the fitted coefficients or the complete dataset that is needed to reproduce the risk adjustment. [Subvertadown risk methodology](https://subvertadown.com/article/the-different-risk-levels-of-fantasy-positions-in-achieving-their-projected-season-score----a-historical-analysis)

TapThatDraft lets a user select BEER, BEER+, or VOLS and configure QB streaming. Its public page does not expose the calculation or the current position counts. [TapThatDraft](https://subvertadown.com/tap-that-draft)

### What is not reproducible from the public material

- The current BEER cutoff for each position.
- The historical seasons, playoff-week treatment, and games-played qualification rules used for those cutoffs.
- The allocation of FLEX demand across RB, WR, and TE.
- The exact order and formula for all five current BEER+ adjustments.
- The fitted risk coefficients and the QB-streaming return model.
- The exact ECR-alignment and ADP-reference transformations.

The cited guide credits Frank DuPont's 2012 man-games concept. A current first-party DuPont specification and a current TapThatDraft position-count table were not available in the reviewed public sources. Historical counts reproduced by other sites are not evidence of TapThatDraft's current inputs.

### Accurate implementation label

Do not label a local BEER/VOLS blend as exact `BEER+`. That name now identifies Subvertadown's five-part method. Use `BEER+-style experimental` when the attribution is useful. Prefer `starter-aware man-games blend` in the product UI because it describes what the app can reproduce.

If development proceeds before the missing inputs are available, use this explicit experimental model:

```text
BEER value = projected points - assumed man-games baseline points
VOLS value = projected points - last-starter baseline points
w = VOLS relevant-player count / (BEER relevant-player count + VOLS relevant-player count)
experimental blend = w * VOLS value + (1 - w) * BEER value
```

This equation is an inference from the published weighted-sum description. It is not a published BEER+ specification. Store each assumed position cutoff, FLEX allocation rule, season length, and projection source with the evaluation artifact. Compare it with the fixed baseline before it can affect live recommendations.
