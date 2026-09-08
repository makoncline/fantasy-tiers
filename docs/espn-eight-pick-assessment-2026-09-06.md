# ESPN eight-pick assessment — September 6, 2026

## Result

Completed the owner's first eight selections in a fresh ESPN league-specific practice draft. Every selection followed the shared assistant's top recommendation. ESPN's bots made the opponent picks. The mock is paused after overall pick 90, with eight players on the owner's team.

The first six picks form a useful starting lineup. The last two picks give less diverse depth: both are Pittsburgh running backs. TE remains open. This is a partial-roster assessment, not an independent draft grade or proof of an optimal team.

## Configuration and evidence

- Practice league: `1642919276`; distinct from the real league.
- 12 teams, snake order, owner slot 7, full PPR.
- Starters: QB, two RB, two WR, TE, FLEX, D/ST, K. Seven bench slots; 16 rounds.
- Ten-minute pick clock. Paused on each owner turn. Auto-pick was off.
- Used the existing ESPN adapter, frozen aggregate bundle, and `buildDraftViewModel`. The ESPN Reader extension was not connected, so the test used captured ESPN HTTP/WS data directly.
- Saved each recommendation and its alternatives before making the selection. All eight readiness checks passed. No strategy changes or recommendation overrides during the run.
- Final HAR replay matched all 90 reconstructed picks exactly, including the eight owner picks. Real league actions remained read only.
- Decision records, source bundle, summary, and verified state: `data/draft-results/espn-eight-2026-09-06/` (ignored local artifacts). Raw HAR: `/private/tmp/espn-eight-final.har` (private; contains data unsuitable for Git).

## Selections

ECR is the saved FantasyPros average. ADP is the captured ESPN average. Both are inputs to the assistant; they are not independent quality scores.

| Pick | Player | Position | ECR | ESPN ADP |
| --- | --- | --- | ---: | ---: |
| 1.07 | Christian McCaffrey | RB | 9.28 | 7.72 |
| 2.06 | Drake London | WR | 13.46 | 20.57 |
| 3.07 | Kenneth Walker III | RB | 24.92 | 24.56 |
| 4.06 | Jaylen Waddle | WR | 34.41 | 52.69 |
| 5.07 | Joe Burrow | QB | 44.94 | 53.06 |
| 6.06 | Luther Burden III | WR | 47.01 | 74.80 |
| 7.07 | Jaylen Warren | RB | 74.43 | 85.84 |
| 8.06 | Rico Dowdle | RB | 85.71 | 96.19 |

## Team assessment

The core is balanced: Burrow at QB, McCaffrey and Walker at RB, London and Waddle at WR, and Burden at FLEX. The saved position ranks are QB4, RB3/RB9, and WR7/WR17/WR22. Those inputs support a positive assessment of the first six picks, but they do not predict the actual season.

Waddle was taken about 11 picks before ESPN ADP, and Burden about nine picks before ADP. Both had better ECR than the selection price. Waddle's ADP was just before the next owner turn at 55. This is a defensible timing decision; the mock does not establish that either player would have survived if passed over.

The depth is less convincing. Warren and Dowdle share the Pittsburgh backfield and Week 9 bye. This gives injury cover within one backfield, but fewer independent opportunities for a breakout. Waddle and Burden also share Week 10. With eight rounds left, these conflicts can still be managed. They should not be hidden by the balanced position counts of four RB, three WR, and one QB.

TE is the remaining offensive starter gap. It is not automatically an error to leave TE open through round eight. At pick 90 the leading available TE was Dalton Kincaid, TE11, ECR 113.65 and ESPN ADP 131.28. Selecting him there would be early against both references. K and D/ST were correctly deferred for this partial run.

ESPN marked McCaffrey and Burden questionable in the capture. This run does not establish injury severity or expected missed games.

## Choices to review

1. **McCaffrey versus Smith-Njigba at 1.07.** Smith-Njigba had the better ECR, 4.81 versus 9.28, and went at the next pick. The model preferred McCaffrey on static league value, 164.8 versus 145.6. Their starter-need and timing components were equal. The generated explanation said roster fit or timing carried the pick, which does not accurately explain these components. Review that explanation before treating it as evidence of a roster-policy mistake.
2. **Warren versus Christian Watson at 7.07.** Watson had better ECR, 57.57 versus 74.43, and higher static value, 25.7 versus 16.9. Warren received a 21.3-point depth component; Watson received zero. That component changed the order. An RB3 is useful, but this is the clearest case where the position-balance preference outweighed a better-rated player. Watson was taken before the next owner turn.
3. **Dowdle at 8.06.** His selection was near market price, but it created a Warren/Dowdle pair while TE remained empty. The leading alternatives were Jonathon Brooks, Kincaid, and Brian Thomas Jr. The proper follow-up is to test the value of same-backfield depth against other roster options, not to force a TE reach or add a player-specific rule.

## Conclusion

Keep the first six picks as a useful observed result. Treat the last two as a roster-construction question that needs a paired test. This single mock does not justify changing the strategy. A useful next experiment would compare the saved round-seven board with a weaker position-balance bonus, then evaluate complete rosters across several fresh rooms.
