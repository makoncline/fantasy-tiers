# Fantasy Tiers: Draft Strategy and External Review Brief

Updated: September 5, 2026  
Implementation checked at commit: `0b0d75c5`

## Purpose and status

This document describes our draft strategy, the model that supports it, and
the questions on which we want outside advice. It can be read without access
to the application or source code.

Our objective is to build the strongest expected starting lineup and useful
bench available from our draft position. We want a team that can compete
through the season, with enough depth to manage injuries and byes.

This is a working strategy reference. The core preferences are established.
Proposed additions and implementation gaps are marked below. A proposal in
this document is not proof that the application already implements it, or that
it improves results.

### Judgment under uncertainty

Projections and rankings are estimates, not known player quality. More decimal
places do not make a choice more certain. The owner clarified this on September 5:
after the evidence stops separating players, drafting becomes a judgment call.

Use the data to narrow the board to a few reasonable choices. Protect clear
value gaps and avoid clear roster mistakes. Treat small modeled gaps as weak
evidence, especially when sources disagree or a small change in assumptions
reverses the order. In that close group, roster fit, a credible path to more work,
and the owner's player preference can decide the pick. Keep those preferences
visible; do not disguise them as precise projected-point advantages.

Experiments should find stable improvements and remove clear failure modes.
They should not optimize a tiny score difference that depends on one forecast.
Check whether a proposed choice still makes sense under several plausible
projections and draft-room patterns. A mock grade or a narrow simulation interval
cannot remove uncertainty about future player performance.

This is the intended decision standard. The current additive Adj model does
not yet enforce a tested close-choice band.

## 1. League context

Our primary target is a managed Sleeper redraft league. We set a lineup each
week and can use waivers during the season. This is not best ball.

| Setting | Primary scenario |
| --- | --- |
| Teams | 12 |
| Draft | Snake, 14 rounds |
| Planned draft slot | 4; use the actual order when available |
| Starters | 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 DEF |
| FLEX eligibility | RB, WR, TE |
| Kicker | None |
| Bench | 5 |
| IR | 1; does not add a draft round |
| Current keepers | None in 2026 |
| Reception | 0.69 points |
| Rushing and receiving yards | 0.1 points per yard |
| Rushing and receiving touchdowns | 6 points |
| Passing yards | 0.04 points per yard |
| Passing touchdowns | 4 points |
| Interceptions thrown | -1 point |
| Lost fumbles | -2 points |
| Points per carry | 0 |
| Defense | Standard Sleeper D/ST scoring |

The selected Sleeper draft and its league are the authority for settings. The
application must not impose this preset on a different live draft. Unsupported
rules must be identified. Full support for auction, superflex, IDP, dynasty,
or other formats is outside the present strategy scope.

Future keeper policy is planning metadata, not an active 2026 drafting rule.

## 2. What each data source does

| Input | Role |
| --- | --- |
| Sleeper league and draft settings | Scoring, roster requirements, draft order, and current picks |
| Sleeper season projections | Expected statistical production scored under supported league rules |
| FantasyPros expert consensus average rank, or ECR | Consensus estimate of player order within each position |
| FantasyPros rank and locally derived tiers | Player-quality context and positional drop-offs |
| Sleeper ADP and draft-board information | Estimates of opponent selection order |
| Current opponents' rosters and recent picks | Position demand and draft-room pressure |
| Sleeper status and available news | Availability risk and ranking-freshness warnings |

Tiers are derived from FantasyPros rankings. They are not an independent third
source. ADP describes market behavior; it does not by itself establish player
quality.

### Base value: Val

Val is independent of our current roster and draft turn. The current model:

1. Applies supported league scoring to Sleeper season projections.
2. Sorts projected point totals within each position to form a production curve.
3. Assigns that curve in FantasyPros ECR order within the position.
4. Compares each assigned total with league-specific positional baselines.

Step 3 is material: Val does not simply retain each player's original Sleeper
point projection. Sleeper determines the shape of the production curve, while
FantasyPros determines which player receives each place on it.

The model combines two baseline comparisons:

- **Value over last starter, or VOLS:** advantage over the estimated last
  starting player at the position across the league.
- **Man-games replacement:** advantage over a deeper replacement level that
  allows for players missing games.

Direct starting slots and the league's FLEX slots determine starter demand.
The model allocates FLEX demand from the remaining RB, WR, and TE point values.
For a position with `S` league starters and `G` assumed games per player:

```text
Replacement player count R = ceiling(S × 17 / G)
Starter weight w = S / (S + R)
Val = w × (player points − last-starter points)
    + (1 − w) × (player points − replacement points)
```

The present game assumptions are QB 15, RB 13, WR 14, TE 14, K 16, and DEF 17.
These are model assumptions, not individual injury forecasts. We want advice
on whether these baselines and weights fit this league.

### Contextual recommendation score: Adj

Adj converts Val into a draft recommendation by adding context. Current
components cover value, timing, starter need, roster construction, QB/TE
strategy, bench balance, league demand, and data/news risk.

The component weights change by draft phase. Adj is a ranking score. It is not
a projected fantasy-point total or a win probability. Its components include
normalization and thresholds, so an Adj gap must not be read as a point gain.
Val and Adj remain visible together so a recommendation can be questioned.

## 3. Rules in priority order

Hard constraints govern eligibility and roster completion. The remaining
rules guide trade-offs; they should not force an inferior roster merely to
satisfy a preferred sequence.

| Priority | Rule | Intended application |
| --- | --- | --- |
| 1 | Use valid data and actual league rules. | Require current, usable sources and supported scoring. Exclude confirmed unavailable players. Keep every selection roster-legal and finish all required slots. |
| 2 | Protect clear player-value advantages. | Start with Val. Small preferences about balance, byes, or team environment should not override a substantial value gap. |
| 3 | Compare the roster available across our next two picks. | Compare a position now plus the likely alternative next turn with the reverse sequence. Measure the value lost by waiting. **Proposed extension; not fully implemented.** |
| 4 | Build strong starters, including both FLEX slots. | Prioritize useful lineup production. Do not fill a weak QB or TE merely because its named slot is empty when stronger FLEX value remains. |
| 5 | Use actual turn distance and room behavior. | Combine market order, intervening teams' demand, and observed picks. Opponents can draft backups after filling starters. Reassess a position run without automatically chasing it. |
| 6 | Take early QB or TE only at a justified price. | Require an elite positional advantage and acceptable RB/WR opportunity cost. Define elite from current quality and drop-off, not fixed player names. Later, protect usable starter quality. |
| 7 | Maintain sufficient RB and WR depth. | Keep the counts reasonably balanced while allowing value to decide close cases. Judge usable depth as well as counts; several weak reserves do not guarantee coverage. |
| 8 | Give each bench pick a purpose. | Seek injury cover, FLEX use, or a credible path to strong starter value. After basic coverage, favor meaningful upside. Do not automatically select our own RB's backup. **Player-specific upside evaluation is a proposed addition.** |
| 9 | Keep K and DEF late. | Use the final rounds for configured slots. Our league needs only DEF. Among close options, consider opening-week usefulness and waiver replacements. |
| 10 | Apply news and risk in proportion to their importance. | Separate season-long absence, material missed-time risk, uncertain role, and ordinary Questionable tags. Check whether news is newer than ECR. Avoid counting the same concern twice. |
| 11 | Use bye coverage to decide close choices. | Prefer useful coverage and avoid concentrated starter byes when values are close. Do not pay a large value cost or draft backup QB/TE only for one bye. **Current implementation provides warnings, not a direct score adjustment.** |
| 12 | Use offensive environment as a small preference. | Consider role, scoring opportunity, and offensive quality when choices are close. A winning team's record alone is insufficient. Avoid duplicating information already in projections and ECR. **No separate team-quality bonus is implemented.** |

### Hard roster policy for this format

- Draft no more than one QB, TE, DEF, or K. Draft zero at a position whose
  configured requirement is zero.
- Do not recommend a player without FantasyPros average rank. Such players
  can remain visible for data diagnosis.
- Do not recommend a player confirmed unavailable for the season.
- Preserve enough remaining picks to fill the required roster.
- Keep K and DEF outside the early and middle draft. The current endgame gate
  excludes them before the final two rounds while another non-special slot
  remains; required roster completion takes precedence.

These limits are intentional for our format. They are not universal claims
about all fantasy leagues.

### Resolving close decisions

Our preferred order is: player quality, next-turn value loss, starter/FLEX
benefit, useful depth, then smaller tie-breakers such as bye coverage and
offensive environment.

A tier is context, not a guarantee that two players are equivalent. We have
not yet validated one universal numerical definition of a close choice. We
want a method that works across draft phases and does not let several small,
correlated bonuses combine into a large reach.

An illustrative two-pick comparison, assuming both sequences fill useful slots:

```text
RB now (Val 80) + expected WR next (Val 45) = 125
WR now (Val 75) + expected RB next (Val 65) = 140
```

The second sequence can be preferable even though the RB has the highest
current Val. These numbers are hypothetical. A real calculation must account
for uncertain availability and how each player fits the roster.

## 4. Important implementation limits

| Area | Current behavior | What remains uncertain or missing |
| --- | --- | --- |
| Next-turn opportunity cost | ADP, tier cliffs, runs, and demand affect Adj. | No direct expected same-position value-loss calculation or complete two-pick comparison. |
| Opponent modeling | Uses current rosters, positional demand, and market signals. | No validated manager-specific or historical league model. Starter completion does not prove a manager will stop drafting that position. |
| Value versus need | Phase weights and several context rules affect Adj. | Need to audit whether overlapping bonuses overwhelm meaningful Val gaps. |
| Bench quality | Uses RB/WR balance and base player value. | No validated player-level breakout or workload-distribution model. An upside label is not an upside estimate. |
| Final-pick timing | Waiting, run, tier-urgency, market-price, and room-demand adjustments are zero on the final own pick. Missing market rank does not lower its score. | Implemented locally after paired experiments. Roster completion, player quality, and availability still apply. |
| Byes | Produces overlap warnings and explanation text. | Does not directly score weekly lineup coverage as a tie-breaker. |
| Team quality | Can influence the source projections and expert ranks. | No separate measured offensive-environment adjustment. |
| News | Structured status influences eligibility, risk, and confidence; detailed news is on demand. | No general headline-sentiment model or validated player-specific missed-games forecast. |

The current recommendation model does not guarantee that Adj always follows
the intended priority order above. Testing that alignment is part of the work.

## 5. Current adjustment weights

These multipliers describe implementation, not proven optimal parameters.
They are not percentages and do not sum to one. Component scales and internal
thresholds also affect the result, so weights alone do not establish influence.

| Component | Starter build | Core balance | Depth build | Endgame |
| --- | ---: | ---: | ---: | ---: |
| Value | 1.00 | 1.00 | 1.10 | 0.80 |
| Timing | 0.35 | 0.40 | 0.35 | 0.20 |
| Starter need | 0.80 | 0.75 | 0.30 | 1.00 |
| Roster construction | 0.80 | 0.75 | 0.45 | 0.35 |
| QB/TE strategy | 0.90 | 1.00 | 0.65 | 1.00 |
| Bench balance | 0.20 | 0.25 | 0.70 | 0.25 |
| League demand | 0.20 | 0.20 | 0.20 | 0.10 |
| Data/news risk | 0.60 | 0.60 | 0.65 | 0.65 |

We prefer simplifying overlapping rules when possible. We do not want a new
bonus for every disappointing pick in one mock.

## 6. How we judge an improvement

We distinguish a legal roster, a strong expected roster, and actual season
results. They are different tests.

For a strategy change:

1. State the general problem and intended decision rule.
2. Save a fixed baseline with the source snapshot, exact settings, seeds, and
   opponent model.
3. Add a focused scenario test through the same recommendation path used by
   the application.
4. Compare the candidate and baseline across all 12 slots with at least three
   fixed seeds per slot. Keep all other inputs equal.
5. Require legal and complete rosters, usable starters, adequate RB/WR depth,
   and correct K/DEF timing. Check both targeted gains and regressions.
6. Inspect the picks that changed, including the alternative passed over and
   what was available next turn.
7. Use a few representative external reviews and held-out draft boards to
   check whether internal results are misleading.

ECR-based simulated finish is an internal regression signal. ECR also helps
create recommendations, so a high ECR grade is not independent proof of better
drafting. Actual season outcomes are also noisy. No independent outcome
evaluator is currently active.

No scoring rule may branch on a particular player's name or ID. Lessons must
be expressed through general features such as value, position, role, timing,
roster demand, and documented risk.

## 7. Highest-priority review questions

1. **Opportunity cost:** What is the simplest reliable way to compare the two
   pick sequences using actual snake-turn distance and uncertain opponent
   selections? How should we avoid overreacting to a projected tier cliff?
2. **Adjustment size:** How should we define a close value choice and prevent
   overlapping need, scarcity, and demand bonuses from causing large reaches?
3. **Value calibration:** Does assigning a league-scored projection curve in
   ECR order preserve enough player-specific scoring advantage? Are our
   starter/replacement baselines and assumed games appropriate?
4. **Bench utility:** What observable information best separates useful injury
   cover, likely FLEX contributors, and credible upside picks in this format?
   When is a direct RB backup worth more than an independent opportunity?
5. **Timing boundaries:** Which market signals should still matter on the
   final pick, and which should disappear because waiting is no longer possible?
6. **Tie-breakers:** Would a small weekly lineup-coverage check improve close
   bye decisions? Is any team-environment adjustment useful after accounting
   for projections and ECR?
7. **Validation:** Which measures or external checks could show improvement
   without merely rewarding the same inputs that drive our recommendations?

### Request to an external reviewer

Please review this strategy for the specified 12-team, 0.69-PPR, two-FLEX,
managed redraft league. Identify the three changes most likely to improve
expected roster strength. For each change, explain the failure mode it solves,
the trade-off, the minimum data required, and a test that could disprove its
benefit. Distinguish supported findings from hypotheses. Note any format
differences in your evidence. Please challenge unnecessary rules as well as
missing ones, and avoid player-specific recommendations or generic draft grades.

## 8. Supporting methods and internal references

The external sources below explain methods. They do not independently validate
our implementation or prove that its parameters are optimal.

- FantasyPros explains replacement value, last-starter value, and value over
  next available in its [VBD definitions](https://support.fantasypros.com/hc/en-us/articles/115005868747-What-is-value-based-drafting-What-do-player-draft-values-mean-VORP-VONA-VOLS-VBD).
- Subvertadown describes combining base value with expected positional loss in
  its [snake-value method](https://subvertadown.com/article/fantasy-snake-drafts-and-strategizing-for-scarcity----snake-value-based-drafting).
- Subvertadown distinguishes expected value from upside and discusses limits
  of retrospective analysis in its [upside study](https://subvertadown.com/article/drafting-for-upside-potential-in-fantasy-football---analysis-of-upside-potential-of-fantasy-positions-and-dependence-on-pre-draft-player-rank).

These repository links are optional for external readers:

- [Strategy research contract](draft-strategy-research-contract.md): accepted
  principles, source evidence, and implementation validation requirements.
- [Detailed source notes](tapthatdraft-research-notes.md): method research.
- [Iteration log](draft-assistant-iteration-log.md): prior experiments and
  decisions; older entries can be superseded by later entries.
- [Project context](project-context.md): product and data architecture.
- [League configuration](../src/lib/draftLeagueConfig.ts): primary settings.
- [Base value model](../src/lib/beerPlusStrategy.ts): scoring, calibration, and
  replacement calculations.
- [Adjustment model](../src/lib/draftValue/index.ts): recommendation components.

This document records the strategy discussion. The research contract remains
the implementation evidence guide. Update this reference when a strategy
decision changes, and mark a proposed capability implemented only after its
code and validation support that claim.

## Experiment status

See [the experiment plan and results](draft-strategy-experiments.md) for the September 5 external-review response. The retained change is the final-pick timing fix. Profile calibration, context caps, and simulated availability remain research candidates; they are not active scoring options.
