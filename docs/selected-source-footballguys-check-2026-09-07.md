# Footballguys ranking check

Read on 2026-09-08 UTC (September 7 in Denver). No scoring or UI code changed.

Source: https://www.footballguys.com/rankings?type=redraft
The public default board has 535 rows. Its selected reception setting is full PPR.
A half-PPR request returned only 15 rows. Thus this is an independent full-PPR
comparison, not an exact 0.69-PPR league evaluation.

Compare the first changed owner pick in each of the 39 paired FP-mode drafts.
Both policies have the same prior board at that point. Exclude later changes
because player availability and roster needs can diverge.

- Footballguys ranks the new choice higher in 23 of 39 cases; the old choice in 16.
- For the 33 same-position cases, it favors the new choice in 19 and the old in 14.
- Cases repeat some player pairs across seeds. These are not independent expert votes.
- Examples of agreement: Collins over Rice, McMillan over Adams.
- Examples of disagreement: Jefferson over Lamb, Stevenson over Jaylen Warren.
- For the earlier Godwin/Pittman example, Footballguys ranks Pittman WR29 and
  Godwin WR35. The experts do not all agree on this pair.

This provides mixed external support. It does not prove improved roster strength,
validate the live draft flow, or establish a Sleeper-mode before/after gain.
No paired previous-policy Sleeper-mode batch exists. This check does not add
Footballguys as an application source or replace the selected source.

Raw source HTML, parsed rows, first-difference pairs, source hash, and counts:
`data/draft-results/post-draft-20260908/footballguys-check/` (ignored).
Name matching removes punctuation and Jr/Sr/III suffixes. Kenneth Walker is
explicitly matched to Footballguys Ken Walker III. All 39 compared pairs match.
