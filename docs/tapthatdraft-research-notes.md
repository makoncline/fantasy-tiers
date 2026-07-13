# TapThatDraft / Hold-My-BeerSheets Research Notes

Last updated: 2026-07-01

## Scope

These notes cover the TapThatDraft page, the 2026 Reddit relaunch post, and the Subvertadown articles tied to TapThatDraft, Hold-My-BeerSheets, BeerSheets-style VBD, mock drafting, snake value, baselines, auction value, and upside. I treated "all docs on that site" as all visible TapThatDraft/drafting docs, not the whole 155-article Subvertadown archive.

## Sources Read

- Reddit relaunch: https://www.reddit.com/r/fantasyfootball/comments/1trc0lt/relaunching_tapthatdraft_and_holdmybeersheets_for/
- Tool page: https://subvertadown.com/tap-that-draft
- Drafting tag/index: https://subvertadown.com/search?tag=Drafting
- Positional ordering / rankings vs projections: https://subvertadown.com/article/tapthatdraft-lets-you-customize-positional-player-ordering---solving-the-old-cheat-sheet-rankings-versus-projections-
- Mock draft prep: https://subvertadown.com/article/how-to-use-fantasy-football-mock-drafts-to-prepare-for-your-real-draft
- Hold-My-BeerSheets: https://subvertadown.com/article/hold-my-beersheets-free-printable-1-pager-cheat-sheets-for-your-fantasy-football-draft
- Simple VBD explainer: https://subvertadown.com/article/simple-explainer-of-value-based-drafting
- Purpose of VBD cheat sheets: https://subvertadown.com/article/the-purpose-of-vbd-cheat-sheets----how-value-based-drafting-tools-help-your-fantasy-draft-strategy
- How to use TapThatDraft: https://subvertadown.com/article/how-to-use-tapthatdraft-in-your-strategy-for-your-fantasy-draft
- Video guide page: https://subvertadown.com/article/video-guide-how-to-use-tapthatdraft----answering-frequently-asked-questions
- Baselines: https://subvertadown.com/article/guide-to-understanding-the-different-baselines-in-value-based-drafting-vbd-vols-vs-vorp-vs-man-games-and-beer-
- Auction pricing / PS%: https://subvertadown.com/article/how-auction-pricing-and-positional-scarcity-work----value-based-drafting-in-fantasy-football-auction-drafts
- Beyond BeerSheets: https://subvertadown.com/article/how-tapthatdraft-goes-beyond-just-a-beersheets-replacement
- Snake Value: https://subvertadown.com/article/fantasy-snake-drafts-and-strategizing-for-scarcity----snake-value-based-drafting
- Upside: https://subvertadown.com/article/drafting-for-upside-potential-in-fantasy-football---analysis-of-upside-potential-of-fantasy-positions-and-dependence-on-pre-draft-player-rank
- Project background philosophy: https://subvertadown.com/article/subvertadown-overview

## What People Seem To Like

- The Reddit response is strongly positive around the live snake-draft feature. The standout comments praised dynamic snake drafting, and the author called team-specific pick suggestions the biggest 2026 upgrade.
- "My Rankings" is a real user-facing differentiator. Users like being able to impose a trusted ranking list, and one commenter asked for multiple saved ranking sets.
- The printable one-pager has a clear audience: people want precise math summarized in a clean, fast paper/mobile format.
- The obvious feature gap raised in Reddit comments: traded draft picks are not handled.

## Core Product Ideas

TapThatDraft is not trying to show every possible statistic. Its product stance is: hide the heavy math, expose the few draft-time signals that change decisions, and let the user move quickly.

Important design choices:

- League settings drive the values: teams, roster slots, flex slots, bench, scoring, TE premium, roster maxes, draft type, and budget for auction.
- The draft output should be a customized value surface, not a generic ranking list.
- For snake drafts, the main number should be a snake-specific priority metric, not raw projected points or static value.
- ADP is shown as a draft-timing signal, not as a raw rank comparison. TapThatDraft uses delta ADP in rounds, with clear wait/act symbols and blanking insignificant deltas.
- ECR is used inside position valuation instead of as a universal overall rank.
- Tiers are visual and compact. They are useful for drop-offs but should not be treated as exact boundaries.
- K and D/ST get near-term schedule/streaming support because those positions are usually late/streamable.

## Value-Based Drafting Takeaways

Subvertadown frames VBD as a way to transform projections into league-specific player values.

VBD should solve three jobs:

- Calculate player point expectations under the user's scoring settings.
- Prioritize across positions based on positional scarcity and roster construction.
- Quantify cross-position tradeoffs so the draft surface is more than a qualitative list.

Important cautions:

- VBD values depend on projections, and projections are uncertain.
- Ordinary projections usually describe expected/mean outcomes, not upside range.
- The tool should guide decisions without pretending decimals are precise.
- VBD assumes some predictability in league behavior, so the assistant needs room-behavior inputs and visible uncertainty.

## Rankings vs Projections

The 2026 "My Rankings" article is especially relevant to us.

Subvertadown's position:

- Projection sources are useful for stat ratios and the general curve of player output by rank.
- Projection sources may be less trustworthy for exact player ordering.
- Many experts publish rankings but not full stat projections.
- TapThatDraft therefore aligns projections to ECR by default, and lets the user replace that positional order with their own trusted ranking list.
- The custom input order is assumed to be typical 0.5 PPR positional order; the tool then converts the resulting values to the user's actual scoring settings.

Potential app implication:

- We could eventually store a "ranking calibration layer" separate from source projections. It would preserve source stat ratios where available, but rescale fantasy point totals to match a trusted positional ordering, such as FantasyPros ECR, a selected expert set, or a user custom order.
- This would be more useful than simply blending ranks and projections, because it addresses the exact failure mode where projections imply a player order that humans do not trust.

## Snake Draft Strategy

TapThatDraft's Snake Value is the most important strategic concept for our app.

Core idea:

- Static value-over-baseline is not enough in snake drafts because each pick has opportunity cost.
- The relevant question is not only "who has highest value now?" but "what value disappears before my next pick?"
- Snake Value combines value-over-baseline with a VONA-style lookahead.

Implementation details from the docs:

- Look one round ahead for each position, using team count as the approximate turn window.
- Smooth remaining player values by position to account for uncertainty in opponent behavior.
- The smoothing window starts small early and grows later.
- Add a fraction of opportunity cost to original value to avoid jumpy recommendations.
- Scale displayed Snake Value back near original value so users can compare boosts/downgrades.
- Do not use PS% for snake as the primary display; Snake Value should bake in the scarcity logic.

Potential app implication:

- Our `DV`, comeback labels, and draft context are directionally right, but should be evaluated against this Snake Value mental model.
- A future version should compute a visible "next-turn opportunity cost" by position: the projected drop between the current candidate and the likely next available same-position candidate, adjusted for opponent roster demand.
- The mock draft simulator is the right place to calibrate this, because we can inspect every pick and compare expected comeback against actual availability.

## Reference Lists And Opponent Behavior

Subvertadown treats the "reference list" as the model of how the room will draft.

Useful options mentioned:

- FantasyPros ADP.
- ESPN/Yahoo/Sleeper draft-room order.
- Own/ECR style ordering.

Why this matters:

- The user needs their value list and the opponents' likely list at the same time.
- The reference list helps scan ahead to identify which players opponents are likely to consider before the user's next pick.
- Platform draft-room order may be more predictive than a generic ADP list if league mates draft straight from the room.

Potential app implication:

- Add a reference-list selector to live and mock draft setup.
- Sleeper draft-room rank/order should be a first-class opponent model, not just a displayed field.
- Our bots should be able to draft from the same selected reference list so mock results match the strategy assumption being tested.

## Mock Drafting Process

The mock-draft article strongly supports the mock system we started building.

Key process lessons:

- Mocks are for learning, not winning.
- A good mock run should test how well the user reacts when expected targets are taken early or unexpected values fall.
- The draft tool should run two lists at once: user/trusted rankings and opponent/reference rankings.
- The tool should account for value, roster balance, opponent roster needs, and near-term positional drop-offs.
- Practice should reveal what roster builds are actually available from a given draft slot.

Potential app implication:

- Our mock draft should become the main calibration lab for the assistant.
- Save draft results, pick snapshots, recommendations, and post-draft analyzer reports so we can review decisions later.
- Add retrospective views that compare what the app recommended, what was picked, and who actually came back.

## Baselines

Subvertadown's recommendation is BEER+ as the default because it balances strong starters with bench/risk coverage.

Baseline notes:

- VOLS: baseline is the last starter. It prioritizes starters and inflates top players. Useful when waiver wire is deep or substitutes are easy to acquire.
- VORP: baseline is the best unrostered player. It is bench-friendly/risk-averse and can underemphasize starters in managed football redraft.
- BEER/man-games: estimates full-season positional demand from starts, byes, injuries, trades, and missed games.
- BEER+: adds proportional starter emphasis on top of BEER, because plain BEER can underprice elite starters.
- QB streaming baseline is optional and should not be used when the league will roster more than about 25 QBs, especially deep superflex/2QB.

Potential app implication:

- Our value model should explain which baseline is driving the default recommendation.
- For managed 1QB redraft, BEER+/starter-aware baselines likely match our desired "strong starters, RB/WR bench utility, no backup onesie by default" strategy better than raw VORP.

## Auction Notes

Auction is not our near-term focus, but several concepts are still useful:

- Auction prices can be derived from value over baseline because managers are buying excess points.
- In theory, VBD auction prices act like a minimax protection against below-average rosters.
- AAV tells what the room is likely to pay; tool price tells what the player is worth under the model.
- PS% means cumulative percentage value remaining at a position after a player is drafted.
- PS% is a roster-balance aid, not a point-value unit.

Potential app implication:

- If we add auction later, separate model value from market price/inflation.
- Do not import PS% into snake drafts as the main scarcity UI; use point-unit opportunity cost instead.

## Upside Notes

Subvertadown treats upside as an overlay after value, not a replacement for value.

Important takeaways:

- Do not evaluate upside from hindsight. A player who became RB1 was not necessarily the best upside bet before the season.
- First build expected value over baseline; then add an upside/range layer.
- Upside can differentiate teams when league mates are already drafting close to VBD optimal.
- Bench picks should be freer to deviate from rankings toward plausible upside paths.
- The article suggests position-specific upside is not simply "take top players"; mid/late pockets can matter.

Potential app implication:

- Add upside/risk context to late bench recommendations, especially RB/WR.
- Avoid letting raw projected points dominate bench choices once starter slots are filled.
- Retrospective mock review should label whether a pick was a value pick, need pick, scarcity pick, or upside pick.

## UI Ideas Worth Copying Or Adapting

- Compact status area: keep freshness and source-health available, but not permanently occupying the first viewport.
- Combined overall list plus grouped position views, with state remembered between them.
- Position toggles in the combined list so the user can compare overall value while excluding filled/low-priority positions.
- Sortable columns for value, ADP delta, tier, and source confidence.
- Delta ADP in rounds with "can wait" / "act sooner" signals instead of raw ADP math.
- Target/avoid marks stored per draft/user/settings.
- Hide irrelevant decimal clutter; show floor/ceiling/upside only when meaningful.
- Color/hue tiers consistently within each position.
- K/DST near-term schedule panels for late-round streaming choices.
- A one-page print/export view could be useful even if the live assistant is primary.

## What We Already Have That Maps Well

- Live Sleeper draft state and local mock draft state share schemas/view-model paths.
- Source health/freshness exists and is visible, though it should be less visually dominant.
- Recommendation reason codes, comeback labels, and roster-context fields already point toward dynamic snake logic.
- Mock draft result saving and Footballguys analyzer reports give us a way to calibrate outcomes.
- Position tables plus available/overall lists exist; the next step is making them easier to toggle/sort/filter.

## Gaps To Discuss

1. Reference-list selector: should Sleeper room order, Sleeper ADP, FantasyPros ADP/ECR, and custom rankings all be selectable opponent models?
2. Ranking calibration: should we rescale projections to trusted rankings, and if yes, should the first version use FantasyPros ECR only?
3. Snake Value: should we add a named Snake Value / opportunity-cost score separate from `DV`, or redefine `DV` around this concept?
4. Compactness: which current draft-status/source-health fields should collapse behind a details control?
5. Targets/avoids: should marks be per draft, per season/scoring, or global?
6. Traded picks: do we need support soon, or is it only important for future real leagues?
7. One-pager: would a printable/exportable sheet help the user, or is the live/mock UI enough?
8. Upside: what data source can support upside flags without inventing narratives?
