# D: market-only prospective protocol

Freeze this protocol, candidate code, platform pool, and canonical comparison bundle before the first new board. The September 5 pilot is development evidence only.

## Candidate

`market-geometric-v1` uses Sleeper's 2026 PPR platform order. At each simulated opponent pick, draw an offset in the remaining ordered pool from a geometric distribution with probability 0.20 (mean offset 4). Remove that player before the next draw. Use 512 seeded sequences per capture. Smooth event counts with `(count + 0.5) / (samples + 1)`. With zero intervening picks, survival is exactly one.

The variation parameter is a fixed test assumption, not an estimated forecast-error distribution. Do not tune it during or after this batch. Missing market prices sort after priced players, with player ID as a stable tie-breaker. Missing ECR, injuries, owner backup limits, roster deadlines, phase rules, and opponent roster needs do not enter this candidate. Position identifies the shared platform pool and reporting strata only. Full Sleeper fantasy-position metadata preserves dual eligibility. Use QB/RB/WR/TE/DEF for the specified zero-K format. Keep unranked platform players in the pool.

## Collection

Collect 12 new complete Sleeper bot mocks, one at each slot, with 12 teams and 14 rounds: 1 QB, 2 RB, 2 WR, 1 TE, 2 FLEX, 1 DEF, 5 bench, zero K. Keep the PPR platform preset used by the pilot. Record the draft metadata and full scoring map if exposed. If no full map is exposed, label it unverified; the app's inferred scoring map is not verified Sleeper scoring and is not the owner's 0.69 scoring.

Use the first 13 own turns of each board. The last own turn has no future forecast. Capture at a paused own turn. Save the prior pick prefix, timestamps, default recommendation, intended actual selection, candidate probabilities, cohort IDs, group forecasts, sample sequences, and frozen input hashes before that selection or any intervening opponent outcome occurs. Confirm the paused prefix again before saving. At completion, require the exact prefix and conditioned actual selection to match. The first pick at the next own turn counts as surviving.

Owner adherence is a separate field. A non-default choice is allowed if the forecast was captured conditional on that choice. No board or forecast can be excluded because it did not follow the default. A changed actual selection makes its conditional forecast invalid. Capture failures remain in the attempt log; replace a failed board only for missing or invalid prospective evidence, never because of accuracy. No retrospective reconstruction. Do not include the old pilot or local bots in the fresh batch.

## Cohorts and measures

Select cohorts before outcomes, identical for the candidate and current-heuristic comparison:

- Broad: top 12 available platform players at each of QB/RB/WR/TE/DEF, excluding the conditioned selection.
- Decision: automatic canonical comparison candidates plus the top three base-value eligible players at each position, excluding the conditioned selection. Eligibility here describes the owner's decision only; it must not filter the opponent pool.
- Positional groups: each nonempty positional subset of the decision cohort. Report probability that at least one survives, expected remaining count, simulated count range, and the simulated range of the best remaining base value when a member survives. These ranges are model outputs, not validated prediction intervals.

Keep missing current-heuristic probabilities visible in coverage totals. Score all candidate observations; compare models on the common cohort only and report that coverage. Compute Brier score, log loss, predicted versus observed survival, and ten equal-width calibration bins. Report position, phase, and wait strata (0–3, 4–7, 8–12, 13+). Report board-level paired Brier deltas and a 2,000-resample whole-board bootstrap interval. Player observations within a board are not independent trials.

For positional groups, score the at-least-one event and remaining-count error. Do not create a current group probability by multiplying marginal survival probabilities. For defense effects, report predicted versus observed defensive picks between turns and offensive forecast error separately where zero or at least one actual defense was selected. These diagnostic strata are fixed now.

## Permitted-use decision and stopping point

The candidate is advisory and cannot change active selections. A limited offensive availability preview can be accepted only if all 12 boards have valid evidence, common decision-cohort coverage is at least 95%, offensive decision Brier improves in at least 8 of 12 boards, and its whole-board paired interval lies below zero. In addition, offensive predicted versus observed survival must differ by at most 0.10, mean defensive-pick count error must be within 0.5 picks per wait, and the candidate's offensive Brier regression in either fixed defense-exposure stratum must not exceed 0.03. These are prospective product screening thresholds, not claims of statistical power or true calibration.

Reject the proposed limited use if the candidate materially worsens the common offensive decision score (paired interval entirely above zero) or shows a clear shared-pool/sequence defect. Otherwise retain it as experimental when the limited-use criteria are not met. Report every position, including DEF, regardless of outcome. Do not tune, suppress a failed subgroup, or start another batch automatically. Even acceptance supports only a preview in this Sleeper bot environment. It does not prove better picks, better fantasy results, or validity for human managers or the owner's custom scoring.
