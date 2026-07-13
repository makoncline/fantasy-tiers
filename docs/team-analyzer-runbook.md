# Team Analyzer Runbook

Last updated: 2026-07-01

## Footballguys Rate My Team

Use this when validating a completed mock draft with an external evaluator:

```text
https://www.footballguys.com/rate-my-team/select-league
```

### Fast Manual Workflow

1. Open the select-league page.
2. Close the draft-guide modal if it appears.
3. Accept or close the cookie bar if it blocks the form.
4. Use `Manual Entry`.
5. Match the mock league settings:
   - `numTeams`: mock config team count.
   - `ppr`: `0` for standard, `0.5` for half, `1` for PPR.
   - `passingYards`: usually `25`.
   - `passingTouchdowns`: usually `4`.
   - roster fields: `quarterbacks`, `runningBacks`, `wideReceivers`, `tightEnds`, `flex`, `superflex`, `teamDefense`, `kicker`.
6. Add players from the typeahead.
7. Submit `Rate My Team`.
8. Wait for the report page to replace the loading state.

Do not press Enter in the player search field unless the dropdown is visible and a result is highlighted. Pressing Enter before any player is selected submits the form and opens a validation modal.

### Useful Endpoints

Player ID lookup:

```text
GET https://www.footballguys.com/staff/players/autocomplete?term=<query>
```

The response is a JSON array:

```json
[
  {
    "label": "Jonathan Taylor (RB, IND) - TaylJo02",
    "value": "TaylJo02"
  }
]
```

Manual-entry validation:

```text
POST https://www.footballguys.com/rate-my-team/validate-manual-entry
Content-Type: multipart/form-data
```

Required payload fields observed:

- `leagueName`
- `numTeams`
- `ppr`
- `passingYards`
- `passingTouchdowns`
- `quarterbacks`
- `runningBacks`
- `wideReceivers`
- `tightEnds`
- `flex`
- `superflex`
- `teamDefense`
- `kicker`
- `teamName`
- `teamRoster`: JSON array of Footballguys player IDs.
- `roster-players[]`: repeated once per Footballguys player ID.

Direct validation with the mock-draft roster returned:

```json
{"valid":true,"message":"Form validation passed"}
```

The final report is created by posting the same manual form to:

```text
POST https://www.footballguys.com/rate-my-team/league/form
```

The browser then redirects to a stable report URL shaped like:

```text
https://www.footballguys.com/rate-my-team/2026/<league-slug>/<team-slug>
```

The generated report content is then loaded by an XHR with:

```text
GET /rate-my-team/2026/<league-slug>/<team-slug>?componentIdNum=1&teamSlug=<team-slug>&leagueSlug=<league-slug>&generate=true&reload=1
```

This generated-report URL returns `text/html;charset=UTF-8`, not JSON. It is a partial HTML report fragment containing the final grade, written analysis, chart config, and position-grade image alt text. After the report is created, the URL can be fetched directly with a normal browser user agent; the 2026-07-01 mock report returned about 42 KB outside Chrome.

Anonymous/free report content is server-gated. The returned HTML includes nav links for `#breakdown`, `#by-position`, and `#game-plan`, but the anonymous response only contains the `#overview` section plus the signup/login roadblock. The full locked sections were not present as hidden HTML underneath the gate.

After logging in, capture the Footballguys browser cookies into an ignored local env file:

```text
data/footballguys-session.env
```

The file should define:

```text
FBG_COOKIE=...
FBG_USER_AGENT=...
FBG_REPORT_URL=...
FBG_REPORT_FRAGMENT_URL=...
```

Keep this file local only. It is under ignored `data/` and must not be committed or pasted into logs.

With the logged-in cookie, the generated-report fragment is the useful programmatic source. The authenticated 2026-07-01 report returned about 168 KB and included `#overview`, `#breakdown`, `#by-position`, and `#game-plan` without the roadblock.

Use the helper script to fetch the currently stored report fragment:

```bash
pnpm run fbg:rate-team -- --existing
```

### End-to-End Saved Draft Workflow

Use this full process whenever a mock draft should be reviewable later:

1. Run the draft in `/mock-draft`.
2. Click `Save result` after the draft is complete, or at the point you want to preserve.
3. Note the saved run directory under:

   ```text
   data/draft-results/<timestamped-run>/
   ```

4. Seed/update the Footballguys ID cache:

   ```bash
   pnpm run fbg:seed-player-ids
   ```

5. Analyze every team:

   ```bash
   pnpm run fbg:analyze-draft -- --result-dir data/draft-results/<timestamped-run>
   ```

The saved run directory should then contain:

```text
draft-result.json
footballguys-slot-1-request.json
footballguys-slot-1-report.html
footballguys-slot-1-summary.json
...
footballguys-slot-N-request.json
footballguys-slot-N-report.html
footballguys-slot-N-summary.json
footballguys-all-teams-summary.json
```

`draft-result.json` is the full mock artifact: simulator config, Sleeper-shaped draft details and picks, event log, all rosters, full player pool, source health, and the draft assistant view model used during the run. `footballguys-slot-N-report.html` is the full authenticated Footballguys HTML report fragment for that team, not just the parsed grade. `footballguys-slot-N-summary.json` and `footballguys-all-teams-summary.json` are lightweight parsed indexes for quick comparison.

### Player ID Cache

Seed the local Footballguys ID cache from `mayscopeland/ffb_ids` before batch analysis:

```bash
pnpm run fbg:seed-player-ids
```

This writes ignored local data to:

```text
data/footballguys-player-ids.json
```

The cache starts from the `ffb_ids` Sleeper-to-Footballguys crosswalk and is updated whenever `fbg:rate-team` has to fall back to Footballguys autocomplete. Prefer this cache over repeated autocomplete calls because it is faster and avoids bad first-result matches for team units.

When the report belongs to a saved mock draft, write it into that draft's ignored result directory:

```bash
pnpm run fbg:rate-team -- --existing --result-dir data/draft-results/<saved-run>
```

That writes `footballguys-report.html` and `footballguys-summary.json` next to `draft-result.json`.

To analyze a specific team from a saved mock draft, first convert that draft slot into a Footballguys manual-entry request:

```bash
pnpm run fbg:request-from-draft -- --result-dir data/draft-results/<saved-run> --slot 1
```

Then create/fetch the analyzer report with a slot-specific prefix:

```bash
pnpm run fbg:rate-team -- \
  --input data/draft-results/<saved-run>/footballguys-slot-1-request.json \
  --result-dir data/draft-results/<saved-run> \
  --report-prefix footballguys-slot-1
```

This works for bot slots and the user slot. The generated request stores Sleeper IDs, player names, and positions so `fbg:rate-team` can resolve Footballguys IDs from the local cache before falling back to autocomplete.

For team defenses, do not trust the first autocomplete result for a bare team name. Footballguys returns unit rows such as `Seattle Seahawks PKs (PK, SEA)`, `Seattle Seahawks QBs (QB, SEA)`, and `Seattle Seahawks (TD, SEA)`. The helper includes player position in generated requests, and `fbg:rate-team` prefers `(TD, ...)` for `DEF` and `(PK, ...)` for `K`.

To analyze every team in a saved mock draft:

```bash
pnpm run fbg:seed-player-ids
pnpm run fbg:analyze-draft -- --result-dir data/draft-results/<saved-run>
```

The all-team runner creates:

```text
footballguys-slot-1-request.json
footballguys-slot-1-report.html
footballguys-slot-1-summary.json
...
footballguys-all-teams-summary.json
```

Use `--slots 1,5,10` to analyze only selected slots. Selected-slot runs write `footballguys-slots-1-5-10-summary.json` instead of replacing the full `footballguys-all-teams-summary.json`. Use `--skip-existing` to rebuild a summary from existing per-slot summaries, and `--continue-on-error` if one team should not stop the whole batch.

Do not hammer Footballguys. The all-team analyzer waits 20 seconds between slots by default; override with `--delay-ms <ms>` only when intentionally doing a small or already-cached run. Fast sequential grading with a fresh `data/footballguys-session.env` cookie has worked, but avoid parallel report creation: Footballguys can reuse/collide on generated league/report slugs and leave one slot stuck on repeated 400 report-fragment errors. If a single slot is poisoned, regenerate just that request with a unique `leagueName` and `teamName`, save it as a retry request in the same run directory, and rerun `fbg:rate-team` for that slot only.

If Footballguys returns a non-OK response, `fbg:rate-team` saves the response body next to the run as `footballguys-*-error-<phase>-<status>.<ext>` and includes a short preview in the thrown error. Check that saved body before assuming the site is broken.

### Draft Retrospective

After reports are saved, generate a pick-by-pick retrospective for the user slot:

```bash
pnpm run draft:retrospective -- --result-dir data/draft-results/<saved-run>
```

Use `--slot <n>` to review a bot or alternate user slot, and `--top <n>` to control how many available players are shown per pick.

The retrospective writes:

```text
draft-retrospective-slot-<n>.json
draft-retrospective-slot-<n>.md
```

The report reconstructs the board at every pick from `draft-result.json`. Overall available-player comparisons use Sleeper ADP so cross-position rankings are not polluted by positional rank fields; position groups still use positional rank/tier. For each pick, review which passed players were gone before the next turn and which could have waited. Those findings are the raw material for improving the draft assistant's Decision Board.

Use a different request JSON to create and fetch another draft report:

```bash
pnpm run fbg:rate-team -- --input data/another-footballguys-request.json --output data/another-footballguys-report.html
```

The request JSON should follow the shape captured in:

```text
data/footballguys-rate-my-team-request.json
```

### Fast Automation Path

For future agents, the fastest path is:

1. Extract the user's mock roster from the mock draft board or simulator state.
2. Resolve each player name through `/staff/players/autocomplete`.
3. Populate the manual form fields.
4. Add hidden `roster-players[]` inputs and set `#team-roster-data` to the JSON ID array, matching Footballguys' own selected-player encoding.
5. Submit the form once validation passes.
6. Fetch the generated-report XHR URL directly and parse the returned HTML for:
   - Overall grade from `img[alt]` or text such as `C+ overall grade`.
   - Playoff odds from the visible text or embedded chart config.
   - Position grades from image alt text such as `Running Back Starters A+`.

If using Chrome/CDP to inject hidden fields, mention that the page DOM was modified to match the site's own typeahead output. For pure API use, prefer validating with `POST /rate-my-team/validate-manual-entry`; use `POST /rate-my-team/league/form` only when intentionally creating a report.

## 2026-07-01 Mock Draft Result

Mock context:

- Route: `/mock-draft`
- Slot: 5
- Teams: 10
- Scoring: standard
- Starters: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DEF
- Roster size: 15

Mock roster submitted:

- QB: Russell Wilson
- RB: Jonathan Taylor, De'Von Achane, James Cook III, Ken Walker III, Cam Skattebo, Austin Ekeler, Nick Chubb, Joe Mixon, Kareem Hunt, Bhayshul Tuten
- WR: Deebo Samuel Sr., Stefon Diggs, Brandon Aiyuk, Keenan Allen
- TE: none
- K: none
- DEF: none

Footballguys mapped IDs:

- Jonathan Taylor: `TaylJo02`
- De'Von Achane: `AchaDe00`
- James Cook III: `CookJa05`
- Ken Walker III: `WalkKe01`
- Cam Skattebo: `SkatCa00`
- Austin Ekeler: `EkelAu00`
- Nick Chubb: `ChubNi00`
- Joe Mixon: `MixoJo00`
- Deebo Samuel Sr.: `SamuDe00`
- Stefon Diggs: `DiggSt00`
- Kareem Hunt: `HuntKa00`
- Bhayshul Tuten: `TuteBh00`
- Brandon Aiyuk: `AiyuBr00`
- Russell Wilson: `WilsRu00`
- Keenan Allen: `AlleKe00`

Visible free report result:

- Overall grade: `C+`
- Label: `Reach for the Stars`
- Playoff chances: 39% average management, 49% good management, 59% great management.
- QB: starters `F`, depth `F`.
- RB: starters `A+`, depth `A+`.
- WR: starters `F`, depth `F`.
- TE: starters `F`, depth `F`.

Takeaway for the mock draft assistant: the completed local mock produced an extreme RB-heavy team with no TE, K, or DEF. That is useful external confirmation that the mock assistant needs stronger roster-composition pressure, especially after RB starters/flex are filled.
