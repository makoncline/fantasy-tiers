# Implementation Brief for a Fantasy Football Draft Assistant

## Executive summary

The strongest implementation takeaway is that your draft assistant should be **projection-first, league-settings-aware, and dynamic**, not just a prettier ranking list. Classic VBD still matters because it converts league scoring and roster rules into comparable cross-position value, but in snake drafts it is incomplete on its own. Recent work from FantasyPros and Subvertadown converges on the same point: **you need a dynamic layer that accounts for what will be gone by your next pick**, not just what each player is worth in a vacuum. FantasyPros frames this as VONA and dynamic VBD; Subvertadown’s 2025–2026 “Snake Value” explicitly combines value-over-baseline with near-term opportunity cost and ADP-aware scarcity. citeturn6view0turn10view0turn29view1

Recent evidence also argues against treating all positions as equally forecastable. Fantasy Football Analytics’ 2025 analysis of 2019–2024 projection bias found that elite RBs and the QB6–10 range were especially prone to disappointment, while WRs were the most stable and predictable among the core fantasy positions. Their rookie analysis for 2025 likewise concluded that projection success is driven heavily by **opportunity and role stability**, not just player talent. That is directly actionable for product design: your assistant should expose not only central projections, but also **positional uncertainty, role fragility, and depth-chart dependency**. citeturn36view0turn36view1

For most **managed redraft snake drafts**, the best current thinking is not rigid “always Zero RB” or “always Robust RB.” The more defensible default is a **flexible Hero RB / WR-heavy approach**: secure either one elite RB early or start with elite WRs if the room pushes RBs up, then attack value and tier cliffs. Recent managed-league guidance from Fantasy Life and 4for4 both leans this way, with explicit format adjustments: PPR pushes WRs up, standard/PP1D tilts back toward RB, superflex crushes late-round QB viability, and TE premium materially raises elite TE value. citeturn14view2turn13view3

Zero RB still works, but mainly when the format and room cooperate. Best-ball data from Underdog Network shows that WR-heavy starts can succeed, but they need disciplined structure: early WR accumulation, a timely first RB, and restraint on over-drafting WRs later. In managed redraft, the case for Zero RB is strongest in **full PPR, 3WR, multiple-flex, active-waiver leagues** where replacement RBs can emerge. It is much weaker in standard scoring, shallow WR-start leagues, and passive-waiver formats. citeturn13view1turn14view1turn13view3

BeerSheets’ enduring contribution was not just math; it was **decision compression**. The best successors are copying its combination of custom league settings, compact value presentation, positional scarcity context, and usable draft-room cues. The most important modern improvements are: **delta ADP expressed in rounds rather than raw ADP**, live-draft dynamic updates, custom platform reference lists, and soft warnings instead of information overload. TapThatDraft / Hold-My-BeerSheets is the clearest recent example of this design direction. citeturn8view0turn8view1turn6view2

Your most important data sources are not all equally trustworthy or equally fresh. Sleeper is high-value for league settings, draft boards, player metadata, trending adds/drops, and platform-specific rank context through a free read-only API. FantasyPros is high-value for ECR, projections, ADP, depth-chart context, and live-draft sync, but much of it is website- and subscription-mediated rather than a clean public API. Real-time market data is increasingly important: sportsbook APIs such as OpticOdds, The Odds API, and Unabated expose player props, futures, line moves, and historical odds; Kalshi and Polymarket expose prediction-market data. These are valuable as **market priors and movement signals**, not as stand-alone truth. citeturn16search0turn20view2turn21view1turn30view0turn31view0turn31view1turn33view0turn32view0turn32view1

The single highest-impact product feature is a **“will he come back to me?” probability** that is better than naive ADP lookup. The current best practical stack is: platform-specific ADP mean and spread, position-run adjustment, tier-drop adjustment, news-driven movement, and optionally league-mate tendencies from historical drafts. Public examples point the same way: FantasyPros’ Draft Intel analyzes up to five years of leaguemate behavior; Subvertadown smooths expected availability over a future pick window; Monte Carlo draft simulators increasingly fit learned availability models from historical drafts. citeturn24view3turn24view2turn10view0turn24view0

For UI, copy the best parts of successful tools instead of trying to outsmart the user with hidden math. The strongest live-draft surface is a **single ranked recommendation list with tabs for positional view, tiers, and roster fit**, plus visible freshness timestamps, news alerts, ADP delta, scarcity cues, and reason codes. DraftSharks, FantasyPros, and TapThatDraft all emphasize that stale static rankings are not enough; dynamic valuations, live sync, and format customization are now table stakes. citeturn29view1turn30view0turn8view0

A final product principle: treat bye weeks, correlation, and “strategy labels” as **soft modifiers**, not hard rules. Bye conflicts matter more in no-waiver best ball and at onesie positions; stacking is core in best-ball tournaments but a lighter tie-breaker in managed redraft; and named strategies are best understood as roster-construction templates that should yield to value and room texture. Your assistant should therefore present **strategy state** and **constraint warnings** without vetoing a clearly superior value. citeturn25view1turn26search3turn14view1turn14view2

## What the research says about drafting math

Classic VBD remains the correct foundation. Joe Bryant’s original framing still holds: player value is determined not by raw points, but by how much a player outscores peers at the same position. Modern FantasyPros definitions formalize the common variants: **VORP** compares a player with a replacement-level waiver option, **VOLS** compares him with the last starter in the league, and **VONA** compares him with what will likely be available at your next pick. FantasyPros explicitly states that its VBD score aggregates VORP, VONA, and VOLS. citeturn28search0turn6view0

The hardest implementation choice is the **baseline**. Subvertadown’s 2025–2026 work is especially useful here because it cleanly separates the use cases. VOLS emphasizes starters and inflates top-end players, which can be reasonable in smaller leagues or aggressive-waiver environments. VORP is more bench-friendly and risk-averse, which is more defensible when benches matter more, including best ball. Their default “BEER+” aims at a compromise between top-end starters and enough reserve depth to manage missed outcomes. Fantasy Football Analytics adds a fourth practical baseline family: **man-games**, which estimates how many players at a position are needed to fill all season-long starts, thereby baking missed games into replacement assumptions. citeturn6view1turn27view1turn38search0

For **auction drafts**, static VBD is stronger than many drafters realize because the format lets you convert value into budget directly. Subvertadown argues that auction prices can scale off value over baseline and that VBD effectively acts as a minimax protection against overpaying any one position. That is not a proof that VBD is perfect in real-life auctions, but it is a strong implementation reason to use VBD-derived auction prices as your default cost skeleton, then layer in inflation and room-specific spend tendencies. FantasyPros also exposes VBD, VORP, and VOLS directly in player values, reinforcing that auction and snake value should not be treated identically. citeturn8view2turn28search10

For **snake drafts**, static preseason VBD is necessary but insufficient. FantasyPros’ support article on dynamic VBD says the key question is not just “how much is this player worth above replacement?” but “how much better is this player than what I can still get at my next pick?” Subvertadown reaches the same conclusion more forcefully: in snake drafts, plain value-over-baseline can still lead you to a below-average roster because pick timing creates immediate opportunity-cost tradeoffs. Their “Snake Value” therefore adds a VONA-like opportunity-cost term and smooths expected future availability over a window that widens from roughly ±2 turns early to ±12 turns later. citeturn6view0turn10view0

The main failure mode of VBD in production is **projection error**. Fantasy Football Analytics found all core positions are, on average, overprojected at the high end, with the strongest downside clustering in elite RBs and non-elite quarterback tiers; they also found WRs are relatively more stable. That means a draft assistant that treats “projected points” as a precise number will systematically overstate certainty, especially near the top of drafts. The better product behavior is to carry periodic projection optimism penalties by tier and position, and expose downside risk rather than just average outcome. citeturn36view0

A second failure mode is **market drift**. ADP is not your ranking; it is a timing model. FantasyPros’ mock-draft ADP updates from tens of thousands of drafts over the past day, and their pages expose both average pick and standard deviation. If your tool uses old ADP or wrong-platform ADP, your “wait one round” guidance will be wrong. The same is true when the market moves fast after injuries, training-camp reports, or preseason usage changes. Freshness is not an add-on feature; it is a correctness requirement. citeturn21view1turn21view2turn30view0

A third failure mode is **positional runs**. Static sheets tell you a position is deep; dynamic rooms tell you seven managers just took the same position. Current tools increasingly adapt to this. DraftSharks markets its dynamic values as changing in response to league settings, opponent/team needs, positional scarcity, ceiling, injury risk, and ADP, while FantasyPros’ Draft Intel and mock customizations explicitly model league-wide and team-specific tendencies. Your app should therefore not “panic-chase” every run, but it should detect when the expected value of waiting has materially changed because the room’s actual behavior has diverged from pre-draft assumptions. citeturn29view1turn24view2turn24view3

## BeerSheets lineage and tool patterns worth copying

BeerSheets became influential because it solved two problems at once: it used **league-custom value math**, and it compressed that math into a sheet people could actually use while the clock was running. Public BeerSheets-era and successor material points to a familiar cluster of elements: value columns, baseline-aware scarcity, tier cues, ADP/ECR reference, auction conversion, and a one-page layout designed for fast scanning. Football Absurdity’s surviving draft form still exposes auction conversion from VORP-style values, and modern BeerSheets-style successors continue to preserve the same underlying vocabulary. citeturn38search2turn38search0

The clearest direct successor is **TapThatDraft / Hold-My-BeerSheets**, launched in 2025 explicitly as a “BeerSheets replacement.” What matters for your product is less the branding than the design choices. The tool keeps customizable league settings, supports snake and auction, offers a printable one-pager plus live web mode, updates dynamically, and intentionally removes low-value clutter. Subvertadown’s own summary of the improvements is highly implementation-relevant: use **delta ADP in rounds**, not raw ADP; integrate ECR into position-calibrated valuation instead of treating raw overall ECR as universal truth; allow alternative platform reference lists such as ESPN, Yahoo, or Sleeper; and always make the list usable on mobile and on paper. citeturn8view0turn8view1turn6view2

The most copy-worthy BeerSheets-era UX patterns are still the simplest ones. First, a **compact one-page positional view** remains excellent for cognitive load. Second, users need **tier boundaries** more than they need five decimal places. Boris Chen’s tiers became popular precisely because they grouped players based on consensus rank clustering rather than pretending every adjacent rank difference is equivalent; his site uses expert rankings from FantasyPros and groups players with similar ranks into tiers to highlight real drop-offs. DraftSharks makes the same case in 2026: rankings can lie, whereas tiers surface “cliffs” and “sweet spots.” citeturn0search1turn29view1

Third, users need **ADP as timing, not as truth**. TapThatDraft’s shift from raw ADP to directional delta-ADP is exactly right: most drafters do not want to mentally compare rank 54 vs ADP 67 under time pressure; they want to know “can probably wait” versus “act now.” FantasyPros’ public ADP pages similarly expose not just mean pick, but high, low, and standard deviation, which is a better interface substrate for urgency. citeturn8view1turn21view1

Fourth, modern successors have moved from “best sheet” to **best live assistant**. FantasyPros’ synced Draft Assistant supports a wide range of hosts, including Sleeper, and its Chrome extension surfaces expert rankings, notes, projections, and top available players directly in draft rooms. DraftSharks’ Draft War Room and FantasyPros’ Draft Intel both center the same idea: live sync, opponent-aware recommendations, and league-specific customization. If you are building the best possible assistant, static exportable sheets should be a secondary mode, not the core. citeturn30view0turn30view1turn29view1turn24view3

What is worth improving beyond BeerSheets is just as important. The biggest gaps are **source freshness, uncertainty communication, and explainability**. Fantasy Football Analytics exposes floor, ceiling, standard deviation, uncertainty, and VOR together, which is much closer to what sophisticated drafters need. ETR and DraftSharks also increasingly expose market movement, late-round targets, ceiling, and injury risk. Your app should therefore retain BeerSheets’ speed while adding three modern layers: freshness badges, probabilistic availability, and “why this recommendation changed” logs. citeturn37search7turn25view0turn29view1

## Ranked strategy recommendations

### Default strategy ranking for managed redraft snake drafts

The ordering below is for the most common target: **10–12 team managed redraft snake drafts**. Best ball, superflex, TE premium, dynasty, and auction change the ordering.

| Strategy | Best for | Avoid when | Implementation signals |
|---|---|---|---|
| **Hero RB with WR-heavy follow-through** | Half-PPR or full-PPR; 2WR/1FLEX or 3WR formats; rooms where WR value remains strong after Round 1; drafters who want both an anchor RB and later flexibility. Fantasy Life’s 2025 managed-league guidance explicitly favored Hero RB / Super Hero RB as default managed-league approaches that still allow strong WR capture. citeturn14view2turn13view7 | If elite RBs are overpriced, if your room shoves WRs down, or if it is standard scoring with unusually fragile WR supply. citeturn13view3 | Recommend when one elite RB tier is intact, WR depth still projects well through the next 2–4 rounds, and RB dead-zone risk is elevated. |
| **Pure WR-heavy / Zero RB** | Full PPR, 3WR, 2FLEX, active waivers, deep benches, and rooms still over-drafting RBs. Underdog and Fantasy Life both describe the core rationale as exploiting RB fragility and WR stability, with best-ball evidence favoring heavy early WR structure. citeturn14view1turn13view1turn13view0 | Standard scoring, shallow starting lineups, passive waivers, or rooms where RB values fall. Also avoid when you miss the correct first-RB timing window. Underdog’s 2025 Zero RB research found that waiting beyond Round 7 for the first RB hurt sharply. citeturn13view1 | Raise when WR projected value dominates, RB tiers are fragile and expensive, league has high waiver liquidity, and user has early WR count with no RB through three rounds. |
| **Robust RB** | Standard or half-PPR, smaller leagues, shallow WR-start formats, or rooms that overcorrect into WR/QB/TE and let strong RB values fall. DraftSharks’ current best-ball guidance is explicit that Robust RB, Hero RB, and Zero RB can all work depending on application rather than ideology. citeturn13view4 | Full PPR with 3WR or 2FLEX, especially if the room lets high-end WRs slide. Avoid loading into the historical “RB dead zone” without strong role conviction. citeturn14view2turn28news28 | Raise when projected RB VOR dominates early, WR drop-offs are shallow, and your format structurally boosts RB touches more than receptions. |
| **Elite QB** | 1QB leagues only when a true rushing or ceiling tier falls; separately, **mandatory priority in superflex / 2QB**. 4for4 says late-round QB talk should be ignored in superflex and that elite QB has become more acceptable in 1QB, while ETR’s 2026 best-ball work recommends taking two QBs if you draft an elite one early. citeturn13view3turn25view0 | 1QB formats where the room is not pushing QBs and you can later access similar outcomes more cheaply. Fantasy Football Analytics found the QB6–10 range especially dangerous from a projection-bias standpoint. citeturn36view0 | Raise if top rushing-QB tier is thinning, your format is superflex, or the QB cliff is imminent and next-pick availability is poor. |
| **Late-round QB** | 1QB redraft with no strong superflex pressure, especially when the room over-drafts QBs. Footballguys notes that three of the prior season’s top-five QBs had ADPs of QB15 or later; 4for4 says late-round QB is once again viable in 1QB formats. citeturn14view4turn14view3 | Any superflex / 2QB league; full stop. 4for4 explicitly says to draft two top-20 passers before they are gone in those formats. citeturn13view3 | Raise if elite tier is gone, mid-tier QB prices are inflated, and multi-QB streaming or upside pairing remains available later. |
| **Anchor TE / Bully TE** | TE-premium, elite-volume TE tiers, redraft rooms that underprice a major TE cliff, and best ball where onesie scarcity plus weekly spike weeks matter. 4for4 recommends moving TE up materially in TE-premium; DraftSharks quantifies a large elite-vs-mid TE gap in TE-premium. citeturn13view3turn15search2 | Rooms where the elite TE tier is already fully priced and WR/RB values are better. In managed redraft, do not pair early TE with early QB lightly in 3WR / 2FLEX rooms. Fantasy Life explicitly advises against taking both a TE and a QB in the first three rounds in those structures. citeturn14view2 | Raise when TE premium exists, an elite TE tier is near exhaustion, or positional drop-off dominates adjacent RB/WR options. |
| **Upside bench and contingent RB drafting** | All managed redraft leagues after starting lineup is mostly built. Fantasy Life’s Zero RB guidance emphasizes muddled-backfield shots and true contingency backs; DraftSharks and ETR both lean on upside and contingent value late. citeturn14view1turn25view1 | Benches that are too short, or leagues where shallow waivers make speculative depth less necessary. | Raise when player has contingent role upside, path-to-workload, rising camp news, or strong market movement unsupported by stale ranks. |
| **Stacking** | Best ball tournaments first; managed redraft second as a tie-breaker. ETR’s 2024–2026 work consistently says stacking is core in large-field best ball, while Underdog notes QB-to-pass-catcher correlation is strongest. citeturn26search0turn26search1turn26search3 | Managed redraft when stacking would force substantial reach or worsen roster construction. | Use as a tie-breaker in redraft and as a larger EV modifier in best ball. |

### How the strategy should change by format

In **full PPR**, WR-heavy and Hero RB improve because WR projections are more stable and receptions widen the floor for top receivers. In **standard** and **PP1D-ish RB-friendly formats**, RBs regain ground and Robust/Hero RB become easier to justify. 4for4 says exactly this: standard and PP1D boost early RB value, while PPR makes WR-heavy openings more viable. citeturn13view3

In **superflex / 2QB**, quarterback scarcity dominates. Late-round QB theory from 1QB leagues mostly stops applying. 4for4 explicitly says to ignore late-round QB chatter and secure multiple top-20 QBs, and DraftSharks’ superflex guidance is built around much higher QB pricing and earlier QB acquisition. citeturn13view3turn11search4

In **TE premium**, elite TE strategy should be materially upgraded. DraftSharks notes that TE-premium widens the gap between elite and mid-tier TEs, and 4for4 recommends elevating the position as a whole, especially high-volume elites. citeturn15search2turn13view3

In **best ball**, roster construction and correlation matter far more because there are no waivers or lineup decisions. ETR’s 2026 work explicitly recommends dynamic position allocation based on how early you spent at QB, stresses position-specific volatility, and favors WR-heavy structures because wide receiver is both more volatile weekly and most demanded by lineups. Underdog’s multi-year Best Ball Mania work also points to 4–5 WRs through Round 7 as a durable edge. citeturn25view0turn13view0

In **auction**, strategy names matter less than price discipline. VBD-aligned pricing is more directly useful than in snakes, because auctions let you buy value across positions instead of waiting for turn structure. Use roster-construction templates as budget targets, not as rigid positional scripts. citeturn8view2turn6view2

In **dynasty**, this report is less complete because your request centered on redraft, but recent mainstream guidance is still directionally clear: age curves, multi-year value retention, and QB importance in superflex materially change priorities. Redraft recommendations should not be naively ported over. citeturn22search6

## Data-source matrix

The table below focuses on sources that are both useful for implementation and realistically maintainable.

| Source | High-value fields | Cost / access | Freshness | Reliability | Implementation notes |
|---|---|---|---|---|---|
| **Sleeper API** | League settings, roster positions, scoring settings, draft board, picks, player metadata, injury status, depth-chart order, trending adds/drops. citeturn19search0turn20view2turn20view3 | Free, read-only HTTP API; no token; rate guidance under ~1000 calls/min. citeturn16search0 | Core player map intended to be cached and refreshed at most daily; trending endpoint can be queried intra-day. citeturn20view2turn20view3 | High for league/draft state; medium for news richness. | This should be your system-of-record for synced Sleeper leagues. Cache `/players` locally; do not hammer it during drafts. |
| **FantasyPros** | ECR, projections, VBD/VORP/VOLS, platform sync, mock-draft ADP with avg/high/low/std-dev, best-ball ADP, depth charts, player news, Draft Intel leaguemate patterns. citeturn16search1turn21view1turn28search10turn21view4turn24view3 | Mix of free pages and subscription products; browser extension / web integration rather than clean public API. citeturn30view0turn30view1 | ADP pages are based on tens of thousands of mock drafts over the past day; rankings/projections/news update throughout preseason. citeturn21view1turn16search7 | High utility, but access can be brittle if scraped. | Best used as a licensed/web-integrated provider or as manual export/import, not as a fragile dependence on unofficial scraping. |
| **Boris Chen tiers** | Consensus-derived tiers and drop-off visualization; excellent for draft-room cliffs. It uses FantasyPros expert rankings as input and groups similar ranks into tiers. citeturn0search1 | Free website. | Generally refreshed when rankings refresh. | High as a tiering surface; not a full recommendation engine. | Great as a comparative visualization layer; weak as a sole ranking source. |
| **TapThatDraft / Hold-My-BeerSheets** | Custom league-value sheets, alternative baselines, delta-ADP in rounds, live dynamic snake/auction values, printable one-pagers. citeturn8view0turn8view1turn10view0 | Freemium / subscription website. | Daily-refreshed URLs; live updates in web mode. citeturn8view0 | High for cheat-sheet UX and customizable logic. | Worth emulating more than ingesting. The main value is product design and math framing. |
| **DraftSharks** | Dynamic values, league-specific tiers, live-draft sync, ceiling, injury risk, ADP, roster/room context, format-specific rankings including TE premium. citeturn29view1turn15search9 | Paid. | Updated continuously in preseason and during drafts; dynamic in-room logic. citeturn29view1 | High, but proprietary. | Strong benchmark for feature parity; complex to replicate because the value is in the integrated model, not just one feed. |
| **4for4** | Multi-site ADP, depth charts, player news, research studies, betting/market-based projections product references. citeturn12search8turn21view5 | Mixed free/paid. | Depth charts reported last updated “5 hours ago” in the captured page. citeturn21view5 | High utility. | Useful as cross-check source and for multi-site ADP normalization. |
| **Establish The Run** | Best-ball research, format-specific position allocation, market movement reports, projected ownership, coaching-change and play-calling context. citeturn25view0turn25view1 | Paid. | Updated continuously during best-ball season. | High for tournament and roster-construction research. | Excellent benchmark for best-ball-specific modules; less directly ingestible as raw data. |
| **Underdog / Underdog Network and platform-aligned ADP tools** | Best-ball ADP behavior, roster-construction studies, stacking/correlation heuristics, advance-rate research. citeturn13view0turn13view1turn26search1 | Mixed official/free content; direct raw ADP access is ecosystem-dependent. | ADP changes fast during offseason. | High as market signal for best-ball, medium for direct redraft translation. | Treat Underdog ADP as a sharp market prior, especially for upside and injury/news responsiveness. |
| **Ourlads / ESPN / FantasyPros / 4for4 depth charts** | Team-by-team pecking order, role competition, fantasy-offense framing. Ourlads states charts are constantly evolving and shows explicit last-updated timestamps; ESPN says its fantasy offensive depth charts are updated throughout the offseason and season. citeturn17search1turn17search13turn21view4turn21view5 | Mostly free websites; Ourlads has paid insider options. citeturn17search8 | Often daily or intra-day. | Medium to high, but sources differ in whether they reflect NFL depth chart or fantasy pecking order. | Use an ensemble or confidence score instead of assuming one source is “correct.” |
| **NFL official injury reports** | Official practice participation and game statuses. citeturn18search0turn18search15 | Free web. | During season, generally reported three times per week before games. citeturn18search15 | Very high for official status, limited for offseason narrative. | Best as the canonical in-season status layer; pair with faster news feeds for offseason roles. |
| **FantasyPros / Rotoworld / RotoWire news** | Player news, rumors, notes, injury writeups. FantasyPros promotes up-to-the-minute player news; RotoWire reports continuous updates. citeturn16search2turn16search14turn18search3 | Free and paid mixes; web/app access. | Near-real-time. | Medium to high, depending on source and parsing quality. | Use as event triggers, not direct ranking truth. Every news item should be normalized into a structured event model. |
| **OpticOdds / The Odds API / Unabated / Pinnacle** | Team totals, game lines, player props, historical odds, line movement, futures, injuries/lineups in some products. OpticOdds explicitly offers real-time normalized sportsbook data, historical movement, futures, and player props; The Odds API exposes historical odds and player-prop history from May 2023; Unabated sells comprehensive real-time props and SSE market data; Pinnacle’s public API access is now restricted to selected users / partnerships. citeturn31view0turn33view0turn31view1turn32view2 | Paid APIs, sometimes expensive. | Real-time or near-real-time. | High as market information, but not free. | These are ideal for a future “market layer”: line consensus, implied team totals, prop medians, and movement alerts. |
| **Kalshi / Polymarket** | Prediction-market prices and market structure. Kalshi provides public real-time market-data endpoints without authentication; Polymarket provides REST/WebSocket APIs and SDKs. citeturn32view0turn32view1 | Public APIs, but market coverage varies. | Real-time. | Medium as a fantasy signal because liquidity and market relevance vary by market. | Use only as a secondary sentiment/market-movement feature where there is real volume and a clearly relevant market. |

### Freshness rules you should implement

Every source in the app should carry a **freshness policy**. Sleeper player maps can be cached daily, but trending adds/drops are near real-time. FantasyPros ADP from mocks is effectively daily. Market feeds and line movement should be treated as real-time. Depth-chart sources should be checked frequently in camp and preseason, but de-weighted if they have not updated recently. If a rankings source has not refreshed after a major injury or depth-chart event, the app should visibly mark it as stale and reduce its influence. citeturn20view2turn20view3turn21view1turn17search1turn17search13turn31view0

## Player-calculation spec and dynamic recommendation engine

### Per-player calculations to store

At minimum, calculate the following for every draftable player:

| Metric | Recommendation |
|---|---|
| **Projected points** | Weighted consensus projection customized to league settings. Prefer projections over rankings where possible because projections are more customizable and generally more accurate than rankings in aggregate. citeturn27view0turn37search5 |
| **Overall rank / positional rank** | Derived from projected points and value metrics, not stored as a fixed external truth. |
| **Tier** | Position-specific tier from projection drop-offs or clustering. Boris Chen- and DraftSharks-style tiers are better than raw ordinals for surfacing cliffs. citeturn0search1turn29view1 |
| **VORP** | Player projected points minus baseline waiver/replacement points at the same position. citeturn6view0turn27view1 |
| **VOLS** | Player projected points minus last-starter baseline at the same position. citeturn6view0 |
| **Auction value** | Dollarized share of positive value over baseline, then adjusted for inflation and room spend. Subvertadown’s auction framing is a strong conceptual base. citeturn8view2 |
| **ADP and ADP spread** | Platform-specific average pick plus distribution inputs such as standard deviation, high, and low. FantasyPros exposes these on mock-draft ADP pages. citeturn21view1 |
| **ADP delta** | `market_pick - value_rank_pick` or, better, rounds-until-market relative to your pick cadence. TapThatDraft’s rounds-based delta is a strong UX pattern. citeturn8view1 |
| **Expected availability at next pick** | Probability that the player is still on the board when your next selection arrives. Use ADP distribution + room behavior, not a hard threshold. citeturn10view0turn24view0turn24view3 |
| **Reach / fall score** | Quantifies whether you are paying ahead of market or receiving value versus market. |
| **Scarcity score** | Near-term positional drop-off before your next pick, not static “scarcity %” only. Dynamic snake-specific scarcity matters more than static PS%. citeturn10view0turn8view2 |
| **Roster fit score** | How well the player fits your current roster structure, open starter slots, flex profile, and exposure needs. |
| **Injury / role risk** | Blend of projection uncertainty, rank dispersion, injury flags, and depth-chart fragility. Fantasy Football Analytics’ risk methodology uses standard deviation across projections and rankings; its 2025 bias work argues for tier-adjusted positional risk. citeturn37search4turn36view0 |
| **Upside / ceiling and floor** | At least percentile-style floor and ceiling estimates. Fantasy Football Analytics exposes floor as a 10th percentile and ceiling as a 90th percentile. citeturn37search7turn37search3 |
| **Expert disagreement** | Standard deviation or interquartile range across expert ranks and/or projections. citeturn37search4 |
| **Market movement** | Short-horizon ADP delta, sportsbook/prop movement, and trending adds/drops. citeturn20view3turn31view0turn33view0 |
| **News urgency** | Structured event score derived from recent news and practice reports. |
| **Bye-week impact** | Soft penalty only; stronger at onesie positions and in best ball / no-waiver formats. citeturn25view1turn34search2 |

### Recommended formulas and pseudocode

Use a modular scoring system rather than one giant opaque number.

```text
projected_points[player] =
    weighted_consensus_projection(player, league_scoring)

baseline_last_starter[pos] =
    projection_of_player_at_rank(
        starters_required_in_league_at_pos(pos)
    )

baseline_replacement[pos] =
    projection_of_player_at_rank(
        drafted_players_expected_at_pos(pos) + waiver_buffer(pos)
    )

vorp[player] = projected_points[player] - baseline_replacement[pos(player)]
vols[player] = projected_points[player] - baseline_last_starter[pos(player)]

dropoff_to_next_tier[player] =
    projected_points[player] - projected_points[next_player_in_same_tier_cluster]

expert_disagreement[player] =
    robust_stddev(expert_ranks[player]) normalized_by_pos

projection_uncertainty[player] =
    robust_stddev(source_projections[player]) normalized_by_pos

injury_role_risk[player] =
    blend(
        projection_uncertainty,
        expert_disagreement,
        injury_status_flags,
        depth_chart_fragility,
        rookie_role_instability,
        tier_adjusted_positional_bias
    )

market_value_gap[player] =
    value_rank_pick[player] - platform_adp_mean[player]

market_momentum[player] =
    recent_adp_change_zscore
    + sportsbook_prop_change_zscore
    + sleeper_trending_add_drop_zscore

availability_prob[player, next_pick] =
    calibrated_model(
        next_pick - platform_adp_mean[player],
        platform_adp_stddev[player],
        current_room_positional_run[pos(player)],
        recent_market_momentum[player],
        tier_cliff_pressure[pos(player)],
        manager_tendency_features
    )

urgency[player] =
    (1 - availability_prob[player, next_pick]) * scarcity_score[player]

recommendation_score[player] =
    w1 * dynamic_value[player]
  + w2 * roster_fit[player]
  + w3 * ceiling_component[player]
  - w4 * injury_role_risk[player]
  + w5 * market_value_gap[player]
  + w6 * urgency[player]
```

For **dynamic value** in snakes, do not stop at VORP or VOLS. Use a VONA-like opportunity-cost term:

```text
dynamic_value[player] =
    static_value[player]
  + alpha * (
        projected_points[player]
      - expected_best_alternative_at_same_pos_by_next_pick
    )
```

That formula is directly aligned with FantasyPros’ VONA framing and Subvertadown’s “Snake Value” logic. citeturn6view0turn10view0

### How recommendations should update during the draft

Update immediately after every pick:

1. Remove the selected player and recompute remaining position curves.
2. Recalculate starter cutoffs and baselines where your own roster state makes a position effectively “filled.”
3. Refresh availability probabilities to your next pick using the actual room, not pre-draft expectations.
4. Increase urgency if a same-position run is happening and the next tier cliff is close.
5. Lower urgency if that position’s market cooled or if there are still multiple equivalent options.
6. Apply roster-fit modifiers that reflect your actual build path, such as “Hero RB already secured” or “still need first QB in superflex.”
7. Trigger news/freshness overrides if a player’s rank is stale relative to current news or market movement.

This design is strongly supported by current commercial tools. DraftSharks says dynamic draft values should respond to league settings, opponent/team needs, scarcity, injury risk, and ADP. FantasyPros’ Draft Intel and mock customizations explicitly adapt to team-specific tendencies and strategy patterns. citeturn29view1turn24view2turn24view3

### Best practical method for “will this player come back to me?”

The best production answer is **not** purely deterministic ranking and **not** a full-blown opponent simulation as your only layer. Use a tiered approach:

Use **deterministic ranking** for the recommendation list because it is stable and understandable. Use **ADP-based availability** as the baseline probability engine because it is fast and easy to calibrate. Add **position-run and room-tendency adjustment** because static ADP ignores the real room. Then optionally add **Monte Carlo simulation** when you have enough historical draft data or enough time between picks to run it. This is exactly the direction suggested by current public tooling: FantasyPros leverages up to five years of league-specific draft behavior; Subvertadown smooths future availability; and open Monte Carlo simulators fit availability from historical draft data using learned models. citeturn24view3turn10view0turn24view0

A strong implementation pattern is:

- **Fast path**: closed-form probability from mean pick and spread.
- **Medium path**: add room-specific overrides from current positional run and platform list.
- **Slow path**: Monte Carlo draft simulation with opponent tendency priors and roster-need constraints.

That gives you high responsiveness without making the app feel jittery or overfit.

## Product roadmap and concrete implementation plan

### Quick wins

Start with the pieces that create immediate user value without needing exotic data contracts.

Build a **league-sync core** around Sleeper first. Import scoring settings, roster slots, draft order, live board state, and player metadata from Sleeper’s free API. That gives you enough to customize values correctly and prove the product where your data access is strongest. citeturn16search0turn20view2

Ship a **projection-first draft board** with:
- projected points,
- VORP and VOLS,
- tier,
- ADP mean and spread,
- ADP delta in rounds,
- availability probability,
- news freshness,
- “why recommended” reason codes.

This is already an immediately useful product if the calculations are correct. It also matches the strongest patterns from BeerSheets successors, FantasyPros, and DraftSharks without overbuilding. citeturn8view1turn21view1turn29view1

Add **source freshness indicators** on every ranking/projection source. This is a major anti-error feature and one many incumbents still under-explain. If FantasyPros ADP is from the past day but a custom ranking set has not refreshed since before a key injury, the app should say so clearly. citeturn21view1turn17search1

Add **soft guardrails**:
- “you are overweight Week 9 bye at QB/TE,”
- “this player’s rank is stale relative to market/news,”
- “this pick is a significant reach relative to this room,”
- “you can likely wait one round,”
- “tier likely collapses before next pick.”

These warnings prevent the most common draft-room mistakes without hijacking the user’s autonomy. citeturn6view2turn29view1

### Medium-term features

Next, add **multi-source modeling**. Merge at least three classes of signal:
- consensus projections,
- market timing data such as ADP,
- structured news / depth-chart / status events.

Then expose a **confidence surface**, not just a rank. Fantasy Football Analytics’ work strongly supports treating disagreement and uncertainty as first-class metrics. citeturn37search4turn36view0

Build a **strategy-state engine**. The app should infer the current build trajectory from the first 4–6 picks and show live guidance such as:
- Hero RB path,
- WR-heavy path,
- early QB/TE path,
- superflex scarcity state,
- best-ball correlation state.

The user does not need a lecture; they need the assistant to know what kind of roster they are building and how the next best moves change. Fantasy Life’s 2025 strategy matrix is a very good model here because it treats early-round combinations as branching paths rather than rigid doctrines. citeturn14view2

Add **league-mate tendency modeling** for synced leagues. Even simple features such as “this manager overdrafts QBs,” “this manager never takes TE early,” or “this room follows platform ranks more than ADP” meaningfully improve availability estimates. FantasyPros has already demonstrated product-market fit for exactly this idea. citeturn24view3turn24view2

### Advanced features

The advanced moat is a **hybrid market-and-projection layer**.

Ingest sportsbook and prop data to create:
- team implied offensive environment,
- player prop medians,
- market-implied position and overall ranks,
- market-implied tiers and tier cliffs,
- line movement flags,
- confidence-weighted market priors.

Real-money markets deserve serious investigation because they may be the best available source for fast-changing player expectations. Do not let the market fully replace projections; use it as a Bayesian correction layer, and only weight it heavily when coverage, liquidity, freshness, and cross-book agreement are strong. OpticOdds, The Odds API, and Unabated all make this feasible, though commercial access may be expensive. citeturn31view0turn33view0turn31view1

Add a **Monte Carlo next-two-round simulator** that can run on demand when the user taps a player or between picks. Use it to answer questions like:
- “If I pass on TE now, how often do I still get a Tier 2 TE?”
- “If I take QB here, what does my likely RB/WR mix look like in two rounds?”
- “How much EV am I giving up to complete this stack?”

This is where your app moves from “smart cheat sheet” to genuine assistant. Public Monte Carlo draft projects and best-ball EV work show the concept is practical. citeturn24view0turn26search0

For best ball, add a dedicated **correlation / stacking module** that tracks:
- QB-pass catcher links,
- bring-backs where relevant,
- cumulative team stacks,
- bye overlap at onesie positions,
- roster allocation targets by site and format.

ETR’s 2026 work is especially strong here and should be treated as a benchmark for best-ball-specific logic. citeturn25view0turn25view1turn26search3

### Recommended UI

The strongest live UI is a three-panel design:

**Main recommendations table**
- rank,
- player,
- position/team,
- tier,
- projected points,
- dynamic value,
- ADP delta,
- availability probability,
- urgency,
- freshness badge,
- reason code chips.

**Roster construction panel**
- current starters and bench,
- open-slot quality score,
- build archetype label,
- bye-week warnings,
- positional exposure and fragility.

**Player detail drawer**
- projection sources,
- floor/ceiling,
- expert disagreement,
- market movement,
- recent news timeline,
- roster-fit explanation,
- “if you pass now” simulation output.

This is the common thread in current premium tools, but you can improve on them by making the explanations more transparent and the freshness state more visible. citeturn29view1turn30view1turn8view1

### Concrete implementation plan

Use this phased build plan:

**Phase one**
- Sleeper sync.
- League-settings parser.
- Projection normalization.
- VORP/VOLS engine.
- Tiers from positional drop-off clustering.
- ADP ingestion for at least one platform and one consensus source.
- Recommendation table with reason codes.
- Freshness and stale-source detection.

**Phase two**
- Availability probability model using ADP mean/spread, next-pick distance, and positional runs.
- Roster-fit engine.
- Strategy-state inference.
- Structured news event pipeline.
- Depth-chart confidence layer.

**Phase three**
- Multi-platform ADP normalization.
- League-mate tendency model for synced leagues.
- Market data ingestion for team totals and season props.
- Prop-to-projection reconciliation.
- Monte Carlo next-pick simulator.
- Best-ball-specific correlation and roster-allocation mode.
- Auction mode with VBD-based price curves and inflation adjustments.

If you execute only one thing exceptionally well, make it this: **a dynamic, explainable recommendation engine that knows your league settings, your roster, your next-pick odds, and the freshness of every source it is using**. That is the highest-leverage path to a genuinely superior fantasy football draft assistant. citeturn10view0turn24view3turn29view1turn30view0

## Open questions and limitations

Some BeerSheets details are no longer documented cleanly in first-party public materials, so parts of its exact column behavior must be reconstructed from surviving forms, successor tools, and community documentation rather than a single authoritative methodology post. The broad picture is clear; some fine-grained implementation details are less certain. citeturn38search2turn38search0turn8view1

Much of the strongest quantitative evidence from 2024–2026 comes from **best ball**, not managed redraft. Best-ball data is still extremely useful for understanding roster construction, positional volatility, and market behavior, but stacking and some allocation rules should be down-weighted when ported to waiver-enabled redraft leagues. citeturn13view0turn25view0turn26search0

Several valuable commercial sources do not offer clean public APIs. FantasyPros, DraftSharks, ETR, and similar products are excellent benchmarks and partial data sources, but their terms, access methods, and refresh mechanics may constrain direct integration. Where access is unofficial or scrape-based, fragility risk is real and should be treated as a product risk, not just an engineering inconvenience. citeturn30view0turn29view1turn25view0
