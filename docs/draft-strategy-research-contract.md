# Draft Strategy Research Contract

Last verified: 2026-09-07

## Purpose

Use this document before changing draft value, recommendation policy, opponent
behavior, or draft-quality evaluation. It is the authoritative link between
external research, product decisions, implementation status, and validation.

The product goal is:

> Build the strongest expected roster available from every draft position by
> making the best informed decision at each pick.

The tool cannot guarantee the best eventual roster. Injuries, breakouts, and
opponent picks are uncertain. It must maximize expected roster strength from
the information available when each pick is made.

## Product Scope And Primary Scenario

This is an owner-first app that is available on the internet. A live draft can
have different team counts, draft types, draft orders, roster slots, timers,
and scoring rules. The selected Sleeper draft is the authority. The related
Sleeper league can supply scoring details that the draft response omits.
Recommendation inputs must come from that draft, its league, and its current
picks. Full optimization for every format is not required. When the model does
not consider a rule, load the draft and name the limitation in the UI.

The actual September 7 league has 12 teams, snake slot 4, one QB, two RB,
two WR, one TE, two FLEX, one kicker, one D/ST, five bench spots, and 0.69
points per reception. It has 15 drafted rounds. IR is not drafted. The older
local preset has no kicker and 14 rounds; do not use it for this experiment.

Research from best ball, superflex, TE premium, auction, dynasty, and leagues
with three starting WRs is supporting evidence only. Apply it after a test
shows that the format difference does not invalidate the decision rule.

## Evidence Rules

Owner clarification, September 5: projections and rankings are uncertain
estimates. Use experiments to remove clear mistakes and find robust choices.
Do not force close choices on small modeled gains. Check plausible forecast
variations, show reasonable alternatives, and leave room for owner judgment.
Simulation precision does not establish player-performance certainty.

Classify evidence before using it:

- **Method:** A first-party description of a draft model or calculation.
- **Current market:** A current-season ranking, ADP set, or expert mock. This
  can show room behavior but cannot prove an optimal strategy.
- **Historical outcome:** A multi-season result with a defined league format.
- **Internal experiment:** A saved mock, decision log, or held-out Sleeper
  board replay from this repository.

Every strategy change must name an accepted principle below. Do not convert
one player, one draft, or one grader paragraph into a general rule.

### Constraint classes

| Class | Examples | Treatment |
| --- | --- | --- |
| League constraints | Eligibility, roster size, actual draft order, enough picks to complete required slots. | Enforce. |
| Owner policy | One QB and TE; ECR required for advice; confirmed season-long absences excluded. | Enforce and label as owner policy. |
| Strategy hypothesis | WR2 by round five, RB/WR balance, late D/ST. | Test benefit separately; failure is not league illegality. |
| Opponent assumption | Backup frequency, early D/ST, response to runs. | Estimate from opponents, not owner policy. |

### Evidence matched to the claim

| Change or claim | Required evidence |
| --- | --- |
| Calculation or state fix | Correctness and regression tests. |
| Explanation or comparison display | Accurate, traceable output; useful distinctions; unchanged selections. |
| Availability forecast | Prospective predictions on fresh boards. |
| New selection policy | Forecast, sensitivity, roster, and changed-decision checks. |
| Better fantasy outcomes | Suitable independent outcome evidence. |

A full historical season evaluator does not block a clearer display or a
calculation fix. A small score lead is a conditional tie-breaker, not certainty.
Check the stability of the reasonable-choice set and material roster paths,
not only the top player's identity. Do not interpret hand-set stress frequencies
as probabilities. Do not vary actual league rules as an uncertainty scenario.

## Accepted Principles

| ID | Decision principle | Evidence | Confidence | Product status |
| --- | --- | --- | --- | --- |
| DS-01 | League size, scoring, and starting requirements must change cross-position value. | [FantasyPros VBD definitions](https://support.fantasypros.com/hc/en-us/articles/115005868747-What-is-value-based-drafting-What-do-player-draft-values-mean-VORP-VONA-VOLS-VBD), [2026 FantasyPros VBD table](https://www.fantasypros.com/nfl/rankings/ppr-vbd.php), [TapThatDraft starter guide](https://subvertadown.com/article/tapthatdraft-easy-starter-guide-quick-steps-to-get-your-hold-my-beersheets-) | High | **Implemented:** capability-checked Sleeper scoring, league size, direct starters, greedy FLEX allocation, and configured K/D/ST demand set the canonical cross-position `VAL`. The model supports only scoring inputs that the projection source can represent. |
| DS-02 | Player quality and room timing are different signals. Use trusted rankings for quality and platform/reference data for likely draft order. | [TapThatDraft ranking calibration](https://subvertadown.com/article/tapthatdraft-lets-you-customize-positional-player-ordering---solving-the-old-cheat-sheet-rankings-versus-projections-), [2026 ADP-referencing guide](https://subvertadown.com/article/timing-your-draft-picks-with-adp-referencing---understanding-tapthatdraft-s-time-priority-ordering-of-players-to-help-you-lead-in-your-draft), [FantasyPros real-time ADP](https://www.fantasypros.com/nfl/adp/overall.php) | High | **Implemented:** native FP and Sleeper projections remain separate. FP is the owner baseline. Selected-source projections set VAL; FP ECR sets tiers. The earlier reassigned curve is only an experiment baseline. Sleeper ADP remains the room-timing signal. After RB/WR starters and FLEX slots are filled, a soft market-price penalty reduces multi-round depth reaches unless roster balance needs that position. |
| DS-03 | A snake recommendation must include next-turn opportunity cost, not static value alone. | [FantasyPros VONA definition](https://support.fantasypros.com/hc/en-us/articles/115005868747-What-is-value-based-drafting-What-do-player-draft-values-mean-VORP-VONA-VOLS-VBD), [Snake Value method](https://subvertadown.com/article/fantasy-snake-drafts-and-strategizing-for-scarcity----snake-value-based-drafting) | High | **Partial:** Sleeper ADP, tier cliffs, position runs, and room demand affect `ADJ` before the final own pick. Final-pick timing and demand are zero; missing market rank has no final-pick score penalty. The Decision Board shows a bounded qualitative return signal for the top recommendation and close alternatives. The model does not calculate expected same-position value lost by the next pick. |
| DS-04 | Roster construction is adaptive. In the target two-FLEX format, keep RB and WR options open and respond to tiers instead of forcing Zero RB, Hero RB, or Robust RB. | [June 2026 two-FLEX expert mock](https://www.4for4.com/2026/preseason/expert-fantasy-football-mock-draft-recap-12-team-half-ppr-may-2026), [July 2026 two-FLEX expert mock](https://www.4for4.com/2026/preseason/expert-fantasy-football-mock-draft-recap-12-team-half-ppr-july-2026), [2026 RB strategy discussion](https://www.fantasylife.com/articles/fantasy/adjusting-your-rb-draft-strategy-in-2026-fantasy-football) | Medium | **Implemented:** phase profiles, RB anchors, WR starter balance, FLEX needs, and bench balance adapt to roster state. More validation is required because current external grading found weak WR starters in one representative roster. |
| DS-05 | QB and TE timing must remain subordinate to usable starter quality and RB/WR opportunity cost. A round deadline is not enough. | [July 2026 two-FLEX mock](https://www.4for4.com/2026/preseason/expert-fantasy-football-mock-draft-recap-12-team-half-ppr-july-2026), [ADP-referencing guide](https://subvertadown.com/article/timing-your-draft-picks-with-adp-referencing---understanding-tapthatdraft-s-time-priority-ordering-of-players-to-help-you-lead-in-your-draft) | Medium | **Implemented:** QB has a quality floor. Non-elite TE completion yields to a consensus ECR/ADP price reach. Evaluation records QB/TE reach separately and does not reward earlier selection by itself. Supported formats stop at one QB and one TE. |
| DS-06 | D/ST is an endgame requirement in this managed redraft product. Spend normal bench capital on RB/WR unless roster completion requires D/ST. | [TapThatDraft 2026 unsupported-feature notes](https://subvertadown.com/article/a-list-of-features-not-supported-in-tapthatdraft-2026-), [4for4 tool FAQ](https://www.4for4.com/faq-page) | Medium | **Implemented:** K and D/ST are ineligible before the final two rounds while a non-special roster slot remains. The rule yields when roster completion requires the special-team slot. |
| DS-07 | Availability and player quality are uncertain. Display confidence and avoid precision that the input data cannot support. | [TapThatDraft VBD cautions](https://subvertadown.com/article/simple-explainer-of-value-based-drafting), [TapThatDraft design summary](https://subvertadown.com/article/how-tapthatdraft-goes-beyond-just-a-beersheets-replacement) | Medium | **Implemented for player availability; partial overall:** structured status separates short-term concern, material risk, confirmed unavailability, and unknown states. Confirmed season-long absences are ineligible. Other risks affect `Adj`, not `Val`. Newer concern news lowers confidence and warns that ECR can be stale. Return timing is qualitative because it does not have a calibrated historical error. |
| DS-08 | Current-room behavior should update timing. Historical league behavior is useful only when enough comparable draft history exists. | [FantasyPros Draft Intel](https://support.fantasypros.com/hc/en-us/articles/7844305180187-What-is-Draft-Intel), [Draft Intel league support](https://support.fantasypros.com/hc/en-us/articles/7846032215323-What-leagues-does-Draft-Intel-support) | High for the capability; medium for our league | **Partial:** position runs and league demand update live. Manager and league-history models do not exist. |
| DS-09 | Draft evaluation must be independent of the recommendation inputs. ECR-based finish is an internal regression signal, not proof that the assistant found the best team. | [September 2026 two-FLEX baseline](draft-assistant-iteration-log.md#2026-09-03---069-ppr-two-flex-baseline) | High | **Partial:** fixed-seed mocks and held-out Sleeper boards provide regression evidence. No independent outcome evaluator is active. |

## Current 2026 Market Context

The current market evidence does not support one rigid RB/WR doctrine for the
primary scenario. A July 2026 expert mock matched its 12-team core offensive
shape: 1QB, 2RB, 2WR, 1TE, 2-FLEX, and 5 bench spots. It showed balanced early
RB/WR demand and a long gap after the first two tight ends. Treat this as
current room evidence, not an optimal-strategy proof.

The primary scenario uses 0.69 points per reception. It is between common
half-PPR and full-PPR formats. Do not silently apply a full-PPR roster rule. Use
each live draft's actual scoring when the required projection inputs exist, and
label any approximation.

## Implementation Map

| Research capability | Current implementation | Next proof |
| --- | --- | --- |
| Trusted quality rank | FantasyPros ECR average plus overall and position tiers | Keep missing ECR recommendation-ineligible. Compare changes against holdout drafts. |
| Opponent timing | Sleeper ADP, current position runs, and league demand | Add a reference-list contract before adding another timing source. |
| Next-turn opportunity cost | Heuristic comeback probability and tier-cliff urgency | Measure predicted return against actual return by position and pick distance. |
| Roster construction | Starter needs, FLEX needs, RB/WR balance, onesie policy, and phase weights | Require complete rosters plus starter-quality and endgame gates across every slot. |
| Risk and confidence | Structured availability, ranking-freshness warning, missing-source confidence, on-demand news detail, and bye warnings | Calibrate missed-time and comeback errors before showing stronger probability claims. |
| Capability-checked custom scoring | The canonical value model calculates projected points only when the required Sleeper fields exist. D/ST and kicker use Sleeper standard projected points only when the imported settings match them. Custom D/ST, nonstandard kicker scoring, points per carry, two-point conversions, and other unmodeled rules are named. Recommendations fail closed when this input is unavailable. | Revalidate field coverage and standard-points reconciliation before the live draft. |
| Evaluation | Multi-seed algorithm mocks, decision logs, local ECR rank, and held-out Sleeper boards | Make all evaluators consume shared league configuration and keep local ECR results labeled as internal regression signals. |

## Validation Contract

A draft-policy change is accepted only when all applicable checks pass:

1. A scenario test proves the intended decision through the canonical
   recommendation board.
2. All configured draft slots run with at least three fixed seeds.
3. Every roster is legal. Separately report owner-policy compliance and the
   predeclared starter-quality, depth, and endgame hypothesis gates.
4. Pick logs show why the new rule changed a recommendation.
5. Local ECR rank is labeled as an internal regression signal.
6. A candidate and its baseline use the same source snapshot, league settings,
   draft slots, bot strategy, and fixed seeds. Compare the targeted quality
   gate and the full core-starter ECR regression signal.
7. The change does not branch on a player name or player ID.

## External Review Experiments

The owner authorized an experiment cycle on 2026-09-05. Use
[draft strategy experiments](draft-strategy-experiments.md) for its priority,
fixed inputs, acceptance gates, and results. Its choice-assistant milestone
sets the current order: explanation, stress tests, separate opponent model,
advisory two-pick preview, then a separate policy acceptance review. It keeps
the final-pick fix and experiment tools. This supersedes the older priority
order below for strategy research. Keep unproven candidates out of active scoring.

## Earlier Priority Gaps

Work in this order because each step makes the next result easier to trust:

1. Keep limitation detection accurate for superflex, restricted FLEX, TE
   premium, points per carry, IDP, auction, and other formats that the model
   does not consider. Do not build full strategy support without an owner need.
2. Keep the fixed-seed evaluator on shared league settings and preserve its
   targeted quality gates and core-starter ECR regression signal.
3. Exclude D/ST until the configured endgame window unless completion requires
   it.
4. Add one browser test for the configured mock workflow and `VAL`/`ADJ` UI.
5. Add capability-checked league-scoring influence to `ADJ` when projection
   inputs meet a defined quality gate.

## Supporting Research

- [TapThatDraft and Hold-My-BeerSheets notes](tapthatdraft-research-notes.md)
- [Background draft strategy synthesis](draft-strategy-research-brief.md)
- [Draft assistant implementation plan](draft-assistant-implementation-plan.md)
- [Draft assistant iteration log](draft-assistant-iteration-log.md)
- [Simulated draft testing plan](simulated-draft-testing-plan.md)

## September 7 same-position experiments

[The frozen post-draft report](post-draft-position-quality-2026-09-07.md) applies
DS-02, DS-03, DS-07, and DS-09. The owner rejected the added comparison
UI and requested a correction to within-position ADJ order. The display change
has been removed. The quality guard, highest-value rule, strict-tier comparator, and
position-timing variant are offline experiments. None is accepted for production.
Their roster forecasts must remain separate by projection source. Paired mocks
and exact saved-state replay are regression evidence, not independent outcomes.

## Selected-source order acceptance

The owner authorized implementing source-ranked within-position ADJ order after
rejecting the added comparison UI. See [the implementation record](selected-source-order-2026-09-07.md).
This is an owner preference under DS-02 and DS-07, not an outcome-superiority claim.
The rank follows the selected source: FP ECR for FP, native projected position
rank for Sleeper. The existing risk contribution can justify an exception.
All 78 frozen full-draft runs complete legal rosters and pass mandatory and
construction checks. Deployment and merge remain outside this authorization.
