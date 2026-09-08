# Emergency draft sheet

Open `/espn-backup`. The ESPN assistant links to it. The home page does not.
Click **Download offline copy** before the draft. Open the downloaded HTML in
Chrome to use it without the site, extension, ESPN login, or internet.

Mark other teams' players **Taken** and your players **Mine**. Click a mark again
to clear it. **Undo** restores the previous marks. Browser storage saves progress.
The download includes current picks and rules. Export/import JSON transfers later
progress between copies. Keep one active copy.

## Verified default rules

Read from the private league's ESPN settings on September 8, 2026. No league
member data, identifiers, or credentials are included in the public artifact.

- 12 teams, snake order, slot 7, 45 seconds per pick, no keepers.
- 16 drafted spots: QB 1, RB 2, WR 2, TE 1, FLEX 1, K 1, D/ST 1, bench 7.
- One IR slot; not drafted.
- Position maximums: QB 4, RB 8, WR 8, TE 3, K 3, D/ST 3.
- Full PPR. Passing: 0.04/yard, 4/TD, -2/interception.
- Rushing and receiving: 0.1/yard, 6/TD. Lost fumbles: -2.
- The collapsed rule form also stores the league's conversion, return, kicking,
  and D/ST scoring as labeled reference rules.

**Restore wife's rules** restores these defaults without clearing picks.
**Clear picks** keeps the current rules and requires confirmation.

## Data and calculation contract

This is a manual cheat sheet, not a second recommendation engine. It imports
`calculateBeerPlusProjectedPoints` and `buildStarterAwareValues`. Points and VAL
use FP offensive projections; K and D/ST use labeled Sleeper standard references.
Missing projections show a dash. Taken/Mine marks never rescore the board.
Roster and offensive scoring edits recalculate points and VAL locally. Reception
points select the closest existing FP ranking set. Each position and FLEX use
their own shard tiers; Overall uses ALL tiers. No ESPN ratings are used.

Conversion, return, and custom K/D/ST stats are absent from the source projection
model. Their form controls are labeled reference only and do not alter values.
The sheet shows a warning when its projection snapshot is over three days old.

## Build and tests

`pnpm run backup:build` creates ignored `public/espn-backup.html` from the current
published aggregates. `pnpm run build` runs it before Next. Thus GitHub Actions
builds and production deployments use the same generator after data refreshes.
No R runtime is required to package already-generated tier values.

The HTML embeds React, shadcn controls, the shared calculation code, and data.
Its CSP blocks network connections and external assets. It needs no service
worker, cache install, server API, or extension. A rewrite serves `/espn-backup`.

- `pnpm exec vitest run src/backup/model.test.ts`
- `BACKUP_TEST_URL=http://localhost:3000/espn-backup pnpm exec playwright test tests/e2e/emergency-backup.spec.ts --config=e2e.config.ts`

The browser test checks manual picks, sort stability, rules, reset, reload,
export/import, a downloaded file with networking disabled, invalid imports, undo,
and a narrow viewport. The existing E2E workflow builds before running it.
