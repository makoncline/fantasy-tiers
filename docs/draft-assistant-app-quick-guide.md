# Draft Assistant App Quick Guide

Use this when running a local mock draft in `/mock-draft`. It is intentionally short; do not read the long runbooks unless blocked.

## Start

1. Run the app with a production build when possible:
   - `pnpm run build`
   - `pnpm exec next start -p <open-port>`
2. Open `http://localhost:<port>/mock-draft` in Chrome.
3. Use 10 teams, 15 rounds, snake draft, standard scoring unless told otherwise.
4. Pick a varied draft slot. Enter a memorable seed.
5. Click `Start local mock`.
6. If the room shows `Bot room`, click the control-bar `Start` or `Advance to my pick` button until it reaches `Your turn`.
7. On each user turn, pick from the assistant panel. If it already says `Your turn`, `Advance to my pick` is supposed to be disabled; just make the pick.
8. After each pick, click `Advance to my pick`.
9. At the end, click `Save result`.

## What To Look At

Use the recommended row first, then the combined board. Position tables are
backup context when you want to compare one position in isolation or sanity
check an open starter spot.

- `VAL`: the app's single tuned pick value score. Bigger is better, but still
  confirm the reason chips and roster fit. Treat close values as a shortlist,
  not a precise decimal ranking.
- `OVR`: FantasyPros overall rank with Sleeper-rank delta when available. Use
  it as source disagreement context, not the pick score.
- Player name suffix such as `(WR7)`: position rank. This is the fastest
  starter-quality check, especially for RB/WR/TE.
- `Tier O/P`: FantasyPros overall tier / position tier. Lower is better. Use
  the position tier to identify elite QB/TE windows and the overall tier to
  compare the full board.
- `ADP (delta)`: expected draft position plus meaningful wait/reach signal.
  `+N` means the player may last about N more rounds; `-N` means the room may
  take the player about N rounds sooner. Ignore tiny deltas.
- Reason chips: use these as the plain-English explanation for why a row
  matters. If the chip and roster shape conflict, open the position table and
  compare the best alternative at the fragile position.

## Table-Only Decision Flow

If you only have the combined board plus position tables:

1. Start with the top recommended/combined-board row.
2. Check the top RB and WR rows in their position tables.
3. If TE is open, check whether a tier-one or top-two TE is available.
4. If QB is open, check whether the best QB is tier-one or a clear viable
   starter value; do not reach before ADP just to fill QB.
5. If the top row is close to an open-starter or elite-TE option, prefer the
   roster-shaping pick.
6. If the top row is clearly ahead and does not create a trap, take it.

## Reason Chips

Trust these:

- `Best value`: strong overall value.
- `Elite QB`: take a top-tier QB only when the board supports it and the QB is
  not before ADP.
- `Elite TE`: scarce starter TE window while TE is open.
- `WR2 anchor`: urgent second useful WR window, usually rounds 3-6.
- `WR starter`: protect the third useful WR/FLEX piece.
- `Tier cliff`: waiting may lose a meaningful tier.
- `Likely gone`: prioritize if you want the player.
- `Bench upside`: valid after starters are stable, mostly RB/WR.
- `QB wait` / `TE wait`: non-elite onesie starter can usually wait while
  RB/WR/FLEX quality is live.

Downweight these:

- `QB done`: do not draft a backup QB just because value is high.
- `TE done`: do not draft a second TE unless very late and clearly better than RB/WR.
- K/DEF rows before the final rounds.
- Big `VAL` on unfamiliar names without confidence, news, or role context.

## App Behaviors To Trust

- The board should automatically narrow to K/DEF only when every remaining pick must fill K/DEF.
- After DEF is filled, the final board should narrow to K only.
- In final K/DEF-only rounds, follow the best visible `VAL` unless there is an obvious reason to prefer the other special-teams slot first.
- If a player appears in both combined and position tables, either pick button is fine; prefer the combined-board row for decision-making.
- Save the result at the end so the draft can be reviewed later if needed.

## After Draft

Review whether the final roster has strong RB/WR starters, usable RB/WR depth,
one viable QB, one viable TE, and no wasted backup QB/TE/K/DEF picks.
