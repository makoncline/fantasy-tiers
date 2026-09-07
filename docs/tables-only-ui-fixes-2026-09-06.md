# Tables-only UI fixes — September 6, 2026

## Scope

Implemented the six fixes from the tables-only draft review. This change does not alter draft scoring, owner policy, or the opponent model. The normal view retains recommendations. The browser experiment hid recommendations only in its isolated copy.

- Preview: compare the selected player with the named alternative. Show signed Val and Adj gaps and the largest component difference. Remove unrelated recommendation copy and unvalidated edge labels.
- Pick facts: show exact own-pick numbers, intervening selections, open starting slots including FLEX, and shared roster byes above the tables.
- Player pools: use tabs for Overall and configured positions, including FLEX. Preserve each tab's sort. State the row count and actual sort order. Each position uses its own shard.
- Player rows: show the first slot a player can fill and current bye overlap. This is slot coverage, not a claim that the player improves projected lineup points.
- Manual choices: explain missing Adj when owner policy excludes a player. Keep manual picking available. Show missing ECR and unavailable status separately.
- Labels: distinguish overall and position tiers, platform ADP, market difference, injury notes, and news timestamps.

Browser checks found two tier metadata defects. FLEX shard tiers were being presented as position tiers. Position previews were presenting position tiers as overall tiers. FLEX now uses position-tier metadata from the dedicated position shards. Preview overall tier comes from ALL. The expanded position table uses the same columns as its compact table.

## Verification

- Full local suite: 511 tests passed in 79 files. The shared tree includes concurrent ESPN work, so this is a whole-workspace result.
- Typecheck, lint, and isolated production build passed. The first isolated build found a stale ESPN source file left in the copy; resynchronizing deletions from the shared source tree removed it. No ESPN source fix was needed.
- Chrome, isolated local mock: started slot 4, selected Gibbs, then inspected pick 21. Verified the wait changed from 16 to 6 opponent selections, independent tab sorting persisted, and early D/ST rows explained manual-only status while retaining Pick.
- FLEX showed McBride TE tier 1. The QB preview showed Lamar Jackson overall tier 5 and position tier 1.
- Lamar's preview named Drake London as the comparison: -44.1 Val, -175.6 Adj, with QB/TE strategy as the largest component difference. Copy states that these are model score differences, not confidence or projected point gains; waiting estimates are unvalidated.
- Screenshots: `/private/tmp/fantasy-tiers-screenshots/tables-pool-final.png` and `/private/tmp/fantasy-tiers-screenshots/tables-preview-final.png`.

This was a focused UI check, not another complete draft or evidence of better fantasy results. No push or deployment was performed.
