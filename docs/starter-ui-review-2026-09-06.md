# Starter-pick screen review

## Run and stopping point

I used the rendered local app, inspected its text and screenshots, and made all
selections through its Pick buttons. I did not use a script to select players or
inspect hidden score inputs to make decisions.

- Release: `4056bb00944ac2f3643ce3054c492c52f7b6da38`, isolated copy on port 3008.
- Seed: `starter-ui-review-20260906`; slot 4; 12 teams; 14 snake rounds.
- Actual reception setting: 0.69. The saved summary uses the broad label `ppr`;
  that label does not replace the detailed scoring map.
- Local bot strategy: Sleeper market. This was not a Sleeper-hosted mock.
- Screen readiness: core 129/129; expected draft pool 184/184.
- Stopped after our eighth selection, at overall pick 93. The next active pick
  was 8.10, owned by another team. I did not advance it.
- Filled QB, two RB, two WR, TE, and both FLEX slots. No bench, kicker, or D/ST
  picks. D/ST remains a late-round decision.
- No app or scoring changes were made during this review.

Saved artifact: `data/draft-results/starter-ui-review-20260906/draft-result.json`.
Screenshots and DOM records: `data/draft-results/starter-ui-review-20260906/screens/`.
This is a deliberately incomplete draft, not a failed full-roster test.

## Pick-by-pick review

### 1.04 — Jahmyr Gibbs, RB (default)

**Screen:** Gibbs Val 170.2 / Adj 186.6. Jaxon Smith-Njigba Val 108.6 / Adj
125.2. Both show overall tier 1. Sixteen opponent selections until pick 21.

**Useful:** A clear default, exact wait, ADP context, and roster-slot purpose.
The 61.6 Val gap made this an easy choice under these inputs.

**Less useful:** The same-tier alternative looked more comparable than its
large value gap suggested. Opening details produced a long column of repeated
model definitions and eight component numbers. The sticky status bar covered
player names after the automatic scroll to the detail control.

**Decision:** Gibbs. No scenario was needed for this decision.

### 2.09 — Christian McCaffrey, RB (override)

**Screen:** Default Chris Olave Val 75.6 / Adj 134.5. McCaffrey Val 129.7 /
Adj 78.6, one overall tier better, with a Short-term concern badge. Six picks
until our next turn.

**Useful:** The explicit 54.1 Val sacrifice warning exposed a major disagreement.
Expanded contributions showed Olave's starter-need term at +80 and McCaffrey's
at −33.6. The displayed risk term was only −3 for McCaffrey. The reversal was
mainly roster policy, not the status badge.

**Less useful:** “Highest Adj” did not explain the recommendation. The reader had
to open and compare detailed component lists to find the main cause. The compact
warning said only “contextual adjustments.”

**Decision:** McCaffrey. I preferred his displayed base-value advantage. The
McCaffrey-first market-order scenario left Olave at pick 28. That supported a
possible path, not a probability claim. His shown Questionable status remained
an uncertainty; I did not seek external news in this screen-only review.

### 3.04 — Chris Olave, WR (default)

**Screen:** Olave Val 75.6 / Adj 152.4. Barkley Val 97.9 / Adj 17.2, labeled a
FLEX starter. We had two RBs and no WR. Sixteen picks until the next turn.

**Useful:** The roster counts and WR-starter label made the current need clear.
Olave was still available, as in the prior hypothetical path.

**Less useful:** The only displayed alternative was another RB with much lower
Adj. A next-best WR or the cost of waiting on WR would have been more useful.
Repeated Val/projection definitions did not add much at this pick.

**Decision:** Olave as WR1. One scenario matching this outcome does not validate
the scenario model.

### 4.09 — Garrett Wilson, WR (close-choice override)

**Screen:** Default Waddle Val 56.7 / Adj 163.6. Wilson Val 56.8 / Adj 163.1.
Barkley occupied the middle card at Val 97.9 / Adj 14.3. Six picks until our next
turn. Drake Maye appeared only in the expanded other-candidates text.

**Useful:** The Waddle/Wilson comparison was a real close decision. The stress
report said “Choice changes with assumptions”; one ECR swap favored Wilson,
while the other five cases favored Waddle. Both winners were initially visible.

**Less useful:** “Present in all six hand-set cases: saquon barkley” described
candidate-set membership, not who won. It highlighted a player who won none of
these cases. The technical ECR-offset descriptions and six repeated case blocks
were much harder to scan than “Waddle and Wilson can swap under these tests.”

**Decision:** Wilson. His slightly higher Val, better displayed ECR, and better
overall tier were sufficient personal tie-breakers. The screen did not prove
that he was better than Waddle.

### 5.04 — Saquon Barkley, FLEX (default)

**Screen:** Only Barkley was displayed: Val 97.9 / Adj 111.9. After selecting
him, QB, TE, one FLEX and D/ST would remain open. Sixteen picks until next turn.

**Useful:** “FLEX starter” correctly explained why a third RB was still a
starting-lineup pick. The open-slot list made the remaining work clear.

**Less useful:** His Val stayed 97.9, but Adj rose from 14.3 to 111.9 after our
WR2 pick and the intervening selections. There was no short explanation of the
change across turns. No QB/TE alternative was shown to help evaluate waiting.

**Decision:** Barkley as FLEX1. This board's unusually late availability is not
evidence that he would be obtainable here in a real draft.

### 6.09 — Jayden Daniels, QB (default)

**Screen:** Daniels Val 13.3 / Adj 68.3; Swift Val 56.5 / Adj 64.9; Jameson
Williams Val 44.3 / Adj 58.1. Six picks until next turn.

**Useful:** Three cards showed different roster paths. The small 3.4 Adj gap to
Swift made it worth examining the QB-versus-FLEX choice. The screenshot fit all
three cards clearly once scrolled to the section heading.

**Less useful:** The preview did not directly compare QB alternatives. Daniels
first led to a Marvin Harrison FLEX scenario. Swift first led to Harrison bench
coverage while QB and TE were still open. That did not answer “Which QB could I
get if I wait?” The two paths had to be viewed sequentially.

**Decision:** Daniels. I filled QB while the two required RB and WR slots were
already covered. The preview did not supply strong additional support.

### 7.04 — Dandre Swift, FLEX (default)

**Screen:** Only Swift: Val 56.5 / Adj 66.0, Short-term concern. The section
badge said “Fill TE” while the card recommended an RB/FLEX. Sixteen picks until
next turn. Expanded status said Questionable.

**Useful:** The FLEX label and resulting open-slot list showed that this filled
the last offensive slot apart from TE.

**Less useful:** “Fill TE” read like an instruction that conflicted with the
recommendation. The screen did not show a TE alternative or explain why waiting
was acceptable. “Open: TE” would convey the roster fact more accurately.

**Decision:** Swift as FLEX2. He remained available even though the previous
market-order scenario removed him. This is a concrete difference between the
what-if and this local bot run, not a measured forecast error or model score.

### 8.09 — Travis Kelce, TE (close-choice override)

**Screen:** Default Kittle Val 9.8 / Adj 134.2; Kelce Val 9.4 / Adj 134.0.
Harrison, a bench option, occupied the middle card. Kittle's compact badge said
Short-term concern; expanded details said “Questionable: Surgery.”

**Useful:** The TE comparison exposed an almost tied choice. Bye labels and
status gave meaningful personal tie-breakers. Kittle shared Week 8 with both
McCaffrey and Olave; Kelce had Week 5 and no displayed concern badge.

**Less useful:** The generic badge did not expose the surgery note until expanded.
This is a reason to inspect the status, not enough evidence to infer its current
medical severity. Bye labels appeared per player, but the choice panel did not
summarize the resulting roster overlap. Harrison was less relevant than the
head-to-head TE comparison.

**Decision:** Kelce. The small modeled gap did not justify ignoring those
visible distinctions. Then I stopped.

## Roster at the stop

| Slot | Player | Displayed bye |
| --- | --- | --- |
| QB | Jayden Daniels | 7 |
| RB | Jahmyr Gibbs | 6 |
| RB | Christian McCaffrey | 8 |
| WR | Chris Olave | 8 |
| WR | Garrett Wilson | 13 |
| TE | Travis Kelce | 5 |
| FLEX | Saquon Barkley | 10 |
| FLEX | Dandre Swift | 10 |

Five picks followed the default. Three were deliberate overrides: McCaffrey,
Wilson, and Kelce. This roster has four RBs and two WRs. Both FLEX picks share
Week 10, and McCaffrey/Olave share Week 8. That would matter when filling the
bench; this run stopped before that work.

## Priorities for our review

1. **Explain the main reason for a recommendation on the card.** At pick 21,
   show that starter need reverses a large base-value gap. “Highest Adj” repeats
   the result without explaining it. Do not tune the weights from this run.
2. **Make open-slot labels factual.** “Fill TE” should not contradict an RB
   recommendation. Show why a position remains open when the recommendation
   serves another starting slot.
3. **Keep material status detail and roster bye overlap easy to inspect.** The
   Kittle/Kelce decision showed why these details can matter for close choices.
4. **Summarize stress results around the choices.** Distinguish winners from
   mere membership in every comparison set. Keep technical cases expandable.
5. **Make previews compare the relevant trade-off.** Show QB-now versus QB-later
   alternatives and remaining holes. Until then, keep previews optional and
   labeled as scenarios.
6. **Reduce scrolling and repeated text.** Keep player names visible under the
   sticky bar, shorten repeated definitions, and make the Pick action easy to
   reach from the comparison. I had to leave the cards for the table Pick buttons.

## What this does and does not establish

The local workflow completed the requested eight picks without a crash. The
cards, explicit gaps, roster purpose, status, and exact turn counts helped.
The best uses were exposing a major policy/value disagreement and making two
close-choice overrides inspectable.

This is a qualitative screen review of one local board. It does not validate
real opponent behavior, probability estimates, player forecasts, or fantasy
outcomes. Barkley at pick 52 and Swift at pick 76 also make it unsafe to treat
this roster as a realistic expectation for the actual room. No selection policy
was changed, and nothing was published or deployed as part of this rehearsal.
