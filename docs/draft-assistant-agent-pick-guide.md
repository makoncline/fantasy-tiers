# Draft Assistant Agent Pick Guide

Use this with `/draft-assistant` during a Sleeper mock draft. The goal is to
make strong picks quickly using our app, without outside research unless the
user asks for it.

## Default Rule

Use the app's recommended player as the pick by default.

This exact rule completed three consecutive live Sleeper mocks from different
slots with no manual overrides. Only compare alternatives when the player is
unavailable, source data is stale or missing, current news invalidates the
input, or the league settings are modeled incorrectly. Close scores alone are
not a reason to override the first recommendation.

## What To Read

- Recommended player: default pick.
- `VAL`: app's single tuned pick score. Bigger is better, but close scores are
  a shortlist, not exact truth.
- Player suffix like `(WR7)`: position rank. Use it to judge starter quality.
- `Tier`: lower is better. Tier-one/top-two TE and tier-one QB are special
  windows only while those starter slots are open.
- `ADP (delta)`: timing context. `+N` means the player may last longer;
  `-N` means the room may take the player earlier.
- Reason chips: quick explanation of the recommendation.

## Roster Shape

Draft toward:

- 1 QB
- 1 TE, preferably elite or strong
- 2+ RB starters plus RB depth
- 3+ useful WR/FLEX options
- 1 DEF and 1 K at the end

Avoid:

- Backup QB
- Backup TE before late rounds
- K/DEF before the final rounds
- QB before ADP just to fill the slot
- Non-elite TE just because TE is open
- Ignoring WR2/WR3 starter quality for too long

## Pick Loop

For each user pick:

1. Read the recommended player.
2. Check whether the pick fits the current roster.
3. If it fits, draft that player.
4. If it is close or questionable, compare:
   - top overall row
   - best RB
   - best WR
   - best TE if TE is open
   - best QB if QB is open
   - best FLEX-compatible player
5. Ask: "If I pass this player, do I lose a useful starter tier before my next
   pick?"
6. Draft the player that improves final roster quality the most.

## Round Guidance

Rounds 1-2:

- Prefer elite RB/WR value.
- Do not leave both RB and WR weak.

Rounds 3-6:

- Protect RB/WR starter balance.
- Treat `WR2 anchor` seriously when you have exactly one WR.
- Take elite TE if TE is open and the next TE tier is likely much weaker.
- Take elite QB only when the board supports it and the QB is not before ADP.

Rounds 7-11:

- Fill QB/TE if still open, but do not force weak options over live RB/WR value.
- Prefer RB/WR bench upside and tier pressure.
- Use RB/WR balance only as a tie-breaker unless the roster is clearly lopsided.

Rounds 12-13:

- Add RB/WR depth unless K/DEF must be filled.

Rounds 14-15:

- Draft DEF and K.
- Follow the app's narrowed K/DEF board.

## Known Traps

- Backup QB/TE value after the starter is filled.
- Pre-ADP QB reaches.
- Middle-round non-elite QB/TE while RB/WR/FLEX quality is live.
- Passing a disappearing elite TE window for generic RB/WR value.
- Waiting too long on WR2/WR3 quality.
- Drafting K/DEF early.
- Forcing an exact RB/WR ratio. Balance is a tie-breaker, not a hard rule.
