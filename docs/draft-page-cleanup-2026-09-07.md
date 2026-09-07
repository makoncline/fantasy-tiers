# Draft page cleanup — 2026-09-07

Requested scope: remove more text and optional features. No selection-policy change.

## Removed
- Personal judgment form, note state, save button, and note export field.
- Assumptions panel, in-page stress runner, evidence download, untested-status text, and duplicate comparison dropdown. The sensitivity model, tests, and command-line experiment tools remain.
- Card starter subtitles and same-tier differences.
- Repeated pick and open-slot paragraphs above the player table. Uncovered bye warnings remain.
- Main-context raw component column in selected comparisons.
- Val/Adj sort preset buttons and visible row-count/sort sentence. Column sorting remains.
- Successful pick-feed paragraph. Failed/stale feed warnings and retry remain.
- Zero-required roster badges, empty previous-pick placeholder, and default source-coverage counts. Coverage remains in Data ready details.

## Shortened or collapsed
- Card explanation button: Details.
- ADP cards: value and color; timing explanation on hover.
- Comparison row controls: plus/minus, with accessible player-specific names.
- Diagnostics: collapsed Tools section.
- Overall pool: 20 initial rows, Show more adds 20. Sort is applied to the full pool before slicing.

## Kept
- Canonical selection scores and policies.
- Overall, position, and FLEX tiers; ECR, ADP, Val, Adj; injury and bye facts.
- Three choice cards, manual table comparisons, player preview, and optional next-pick scenario with an uncertainty label.

## Verification
- 508 tests passed across 77 files.
- Typecheck, lint, and production build passed.
- Latest local build served on port 3017; no production push or deployment.

Recovery: this record names the removed functions and UI elements. Pre-sync shared files are backed up in /private/tmp/draft-cleanup-before-sync. Git history retains the earlier design. Do not restore whole files over later work; restore only the feature needed.

## Compact source tables — second pass

Owner request: use one market column for the selected source, remove the main-table delta, use a BeerSheets-style grid, and move full source comparisons behind a player click.

Changed:
- One shared column definition for Overall and the separate position shards: Tier (Overall/RB/Flex/etc), Player, TM/BYE, PTS, VAL, ADJ, and ADP in Sleeper mode or ECR in FP mode.
- Dense single-line rows, a clear header, column borders, retained ADJ shading, and tier bands when tier-sorted.
- Player names open the existing details dialog. Separate Sleeper and FantasyPros panels have matching PTS/VAL/ADJ rows, plus their ADP or ECR. Duplicate active-source metrics were removed from the native-source detail view.

Removed from rows:
- The second market rank column and ADP-versus-ECR delta.
- Separate team/bye subtitle.
- Positional ECR rank appended to each name (position remains).
- Inline Compare button, Sources disclosure, full injury text, bye-overlap text, and policy explanations.
- Separate eye/preview action. The name is the accessible details button.

Retained in details: both source values, ADP/ECR difference, tiers, roster fit, bye conflicts, source/injury status, news, comparison controls, and adjustment contributions. An injury marker remains in the row. Local mock Pick buttons remain. No scoring, roster policy, or tier calculation changed.

Verified: 523 tests across 84 files, typecheck, lint, and isolated production build passed. Chrome on localhost:3017 showed the correct ADP/ECR column in each source, position-specific tier headers, tier bands, and separate source panels from a player-name click.

Screenshots:
- `/private/tmp/fantasy-tiers-screenshots/compact-sleeper-table.png`
- `/private/tmp/fantasy-tiers-screenshots/compact-fp-rb-table.png`
- `/private/tmp/fantasy-tiers-screenshots/compact-source-details.png`

Local only. No push or production deployment in this UI pass.

## Separate, linkable table sections

Replaced the position tabs with a link bar and separate sections. Overall is collapsible and retains its table state while closed. Its multi-select position filters affect only Overall. FLEX switches RB/WR/TE together without changing QB/K/DST. Reset clears all position exclusions. Each configured position and FLEX has a separate shard-backed table below Overall. Source comparison remains a separate collapsed section.

Section anchors: `#players-overall`, `#players-rb`, `#players-wr`, `#players-flex`, `#players-qb`, `#players-te`, `#players-def`, `#players-k` when configured, and `#players-sources` for Sleeper drafts. These preserve the draft query parameters. Hash navigation opens Overall or Sources when needed and handles fresh loads after draft data arrives.

Verified: 523 tests, typecheck, lint, and production build passed. Chrome confirmed grouped filters leave the separate RB table unchanged, Reset restores Overall, and a reload at `#players-rb` places that section 16px below the viewport top. Screenshot: `/private/tmp/fantasy-tiers-screenshots/overall-position-filters.png`. No scoring or source-calculation changes. Local only; not pushed.

## Remove all draft-page cards

Owner direction: no cards and no nested cards. Removed Card primitives and card-like border/background/shadow wrappers from draft status, recommendations, future-pick paths, Player Pool, Overall, each position table, selected comparisons, bye facts, source comparisons, player-detail sections, news entries, and draft setup. Replaced them with plain sections, headings, spacing, and single divider lines. Kept table grids and normal dialog/control chrome.

Verified in Chrome: zero card containers on the page and with player details open; source values still display side by side. All 523 tests, typecheck, lint, and the production build passed. Screenshots: `/private/tmp/fantasy-tiers-screenshots/flat-draft-page.png`, `flat-player-tables.png`, and `flat-player-details.png`. Local only; not pushed.

## Draft sidebar

- Added `DraftSidebar`, open by default, with collapsible status, team counts, roster, and navigation groups.
- Replaced the main status section and full-roster disclosure. Removed the unused `DraftStatusCard` and its replaced tests.
- Kept the turn, open starter slots, and feed state outside the collapsible content. Refresh and Change draft are in its small menu.
- Used canonical snake-turn math and assigned roster slots. Open slots are not urgency scores. The explicit urgency message applies only when all remaining picks must fill starters.
- Added position-colored roster names, bye weeks, source injury status, empty slots, and the existing player detail dialog.
- Linked recommendations, Overall, each configured position, shared FLEX, room needs, and Sleeper. Overall reopens even when the current hash already targets it.
- The league summary uses canonical room starter needs, including shared FLEX. It does not predict opponent picks.
- Desktop: sticky 17rem column. Mobile: collapsible top panel. No cards added. No selection changes.
- Verification: 522 tests in 84 files; typecheck, focused lint, and production webpack build passed. Desktop Chrome showed a 12px sticky top offset and zero card elements. Overall reopened from sidebar navigation. At 390px, page width stayed 390px and collapsed status/open slots remained visible. The current mock has no owned players; populated-player dialog interaction was not exercised in this browser pass.
- Screenshots: `/private/tmp/fantasy-tiers-screenshots/draft-sidebar-desktop.png` and `draft-sidebar-mobile.png`.

## Recommendation comparison table

- Replaced the three-column recommendation layout with one table: Tier (Overall), Player, TM/BYE, PTS, VAL, ADJ, and source-specific ADP/ECR.
- Each player has a full-width reason row. Status concerns remain visible. The canonical recommendation and comparison selection are unchanged.
- Player names open pick-detail dialogs with both source values, contribution breakdowns, position tiers, bye overlap, and data/status notes.
- Next-pick scenarios now open in a separate dialog. They retain the hypothetical-market-order and uncertain-availability labels.
- Removed inline detail expansion and large metric blocks. Retained optional local Pick actions; live tables do not submit picks.
- Updated integration tests for table rows and dialog portals. All 522 tests passed, plus typecheck, focused lint, and production build. Chrome checks verified source-specific columns, details, scenario failure output, unchanged default, and zero cards. Mobile width stayed 390px without page overflow.
- Screenshots: `/private/tmp/fantasy-tiers-screenshots/recommendation-comparison-table.png`, `recommendation-details-dialog.png`, and `recommendation-table-mobile.png`.

## Remove the source comparison section

- Removed the separate Source comparison section, Sources navigation link, disclosure state, and hash handler.
- Deleted the unused `DraftSourceComparison` component.
- Kept the source toggle, both precomputed source calculations, and source values in player/pick detail dialogs.

## Compact team counts

- Replaced duplicate owned-count and vertical starter-count lists with wrapping inline slot counts: QB 0/1, RB 0/2, FLEX 0/2, Bench 0/5, etc.
- Added RB/WR ratio using all owned RBs and WRs, including FLEX and bench. Slot fractions still represent assigned slots, not total players at that position.

## Remove duplicate table navigation

- Removed the Player Pool heading and its navigation row. The sidebar now provides section links.
- Kept all table sections, IDs, Overall filters, and hash navigation.

## Floating draft sidebar

- Replaced the reserved sidebar column with the existing shadcn non-modal Popover. Tables now use the full page width whether the panel is open or closed.
- Added a fixed lower-left toggle. It shows the current turn and, when closed, open slots. The panel opens by default and scrolls within the viewport.
- Page interaction remains available without a dimmed overlay. Section links close the panel before opening and scrolling to their target.
- Kept collapsible groups and existing data. No selection changes.

## FLEX filter and kicker reference

- Changed FLEX from a group-removal toggle to a FLEX-only shortcut. It selects RB/WR/TE and excludes the other configured positions. Clicking it again restores all positions.
- Always show the kicker position shard as a reference table and add a sidebar K link. No-kicker leagues show rank reference columns instead of unusable PTS/VAL/ADJ.
- Added explicit FantasyPros Rank (K), sorted ascending. Missing ECR average or projections does not hide a kicker reference row. This does not change recommendation or roster eligibility.

- Owner clarification: keep kickers hidden for leagues with no kicker slot. Removed the new reference table and rank column; retained only the FLEX filter correction.

## Use the shadcn Sidebar layout

- Replaced the Popover with the existing shadcn SidebarProvider/Sidebar, using floating appearance and off-canvas collapse.
- Open desktop sidebar reserves its width; collapsed sidebar releases that width. Page heading and draft metadata use the same inset. The main toggle stays accessible.
- Mobile uses the Sidebar component's Sheet drawer. Navigation closes the mobile drawer, while desktop navigation leaves the sidebar open.
- Corrected the existing sidebar CSS variable width syntax for the current Tailwind build.
- Verification: 8 focused integration tests, typecheck, lint and production build passed. Chrome measured table width 1061px open and 1317px collapsed; header/content left edges were 280px beyond the 256px sidebar. Mobile drawer opened/closed with 390px page width and no overflow.

## Remove diagnostics controls

- Removed the Diagnostics switch and its otherwise-empty Tools disclosure from the shared player pool.
- Normal draft views and internal diagnostic test support remain unchanged.

## Position scarcity above tables

- Added `Value left: N%` above each position table, including the separate FLEX pool.
- Calculation: undrafted positive native Val / total positive native Val in that position shard. Uses the selected Sleeper or FP calculation and current pick overlay. Negative, missing, and nonfinite values do not contribute; no positive baseline displays an em dash.
- Tooltip defines this as remaining value, not player survival probability. The old per-player aggregate scarcity snapshot is not reused.
- This display does not change ranking or recommendations.

## Automatic next-turn table

- Removed the per-recommendation Next pick buttons and scenario dialog.
- Added one automatic next-turn table under the current recommendations, conditional on taking the current default and the existing market-order scenario.
- Uses React Query to cache the scenario by complete snapshot and first-pick ID, so unchanged polling does not rerun it. Input changes show loading rather than old rows. Failed previews do not remove current recommendations.
- Shows up to five scenario choices with Tier, Player, TM/BYE, PTS, VAL, Scenario ADJ, and ADP/ECR. No pick actions are available on future rows.
- Labels the assumption explicitly; no validated availability probabilities are claimed. A first choice that disappears before the owner's turn produces an explanation, not a fabricated remaining board. Final picks have no next-turn preview.
- Removed the unused manual scenario hook. Existing research/experiment tools remain.
- Final verification: all 521 tests passed; typecheck, lint and production build passed. A development-only local mock displayed Nico Collins, George Pickens and Brock Bowers in the next-turn table at 2.09. No per-player Next pick buttons remained. The original Sleeper mock was not changed.
- Screenshot: `/private/tmp/fantasy-tiers-screenshots/automatic-next-turn-table.png`.

- Renamed the Your choices heading to Recommendations.

## Shared compact player details

- Replaced the separate recommendation dialog with the same dialog used by overall tables, position tables, and roster entries.
- Header now shows the player name and Compare +, then position, team, bye, and one status. Depth uses `Depth: TE1`.
- Replaced source panels with one Sleeper/FantasyPros table: Source, PTS, VAL, ADJ, Market. ADP and ECR use explicit labels and round.pick. Missing source values stay `—`; neither source substitutes for the other. Specialist projection provenance remains explicit.
- Tiers use the overall and actual position shards. The short explanation reads the selected source's actual score components and selects the largest absolute nonzero adjustment, excluding the base-value contribution.
- Removed the generic subtitle, Draft value heading, room starter counts, ADP/ECR delta, repeated status/injury notes, fit/bye-conflict prose, automatic alternative comparison, separate Compare block, and wide two-column layout.
- Moved comparison state to the shared workspace so recommendation and roster dialogs can use the same three-player comparison list.
- Adjustment breakdown is collapsed, names its source, and omits zero contributions. News is collapsed and fetches only when opened. Following owner feedback, removed nested news expanders: headlines, dates, complete returned reports, and source links now appear directly inside News.
- No scoring or recommendation code changed in this cleanup.

Verification:

- Full suite: 521 tests passed in 86 files before the final news-only simplification. The two affected dialog integration tests passed again after it. Typecheck, focused lint, and final production build passed.
- Integration checks cover both source values, missing values, source-specific positive/negative adjustments, single status, comparison toggle, omitted zero contributions, and full news reports without nested controls.
- Local Chrome checks: Tyler Warren shows Sleeper 159.6 / 32.2 / -72.0, ADP 5.02; FantasyPros 154.2 / 21.2 / -109.2, ECR 5.06; overall tier 8 and TE tier 2. Source switching changes the explanation source. Recommendation details use the same table and Compare action. Compare adds the player to the shared list.
- Settled desktop dialog: 574 × 378 content area; no internal scrolling. Mobile: 388 × 390 at 390px viewport and 318 × 390 at 320px viewport, within viewport bounds and without horizontal overflow. No browser page errors.
- Screenshots: `/private/tmp/fantasy-tiers-screenshots/compact-player-desktop.png` and `/private/tmp/fantasy-tiers-screenshots/compact-player-mobile.png`.
- Rebuilt local preview on port 3017. No push, deployment, or Sleeper draft action.

## Content-width player tables

- Set overall, position, recommendation, next-turn, and selected-comparison tables to automatic content width rather than full container width.
- Set player-name columns to a common 14rem (224px) minimum. Longer names can use more space.
- Recommendation reason rows wrap within the player table width instead of setting its intrinsic width. Existing table containers retain horizontal scrolling on narrow screens.
- Verification: typecheck, focused lint, and production build passed. Chrome at 1440px measured recommendations at 571px and overall/position tables at 564–595px. Name columns measured 224px. Collapsing the sidebar did not change table widths. At 390px, the page remained 390px wide; tables scrolled inside their containers.
- Screenshot: `/private/tmp/fantasy-tiers-screenshots/content-width-player-tables.png`. Local port 3017 rebuilt; no scoring changes or deployment.

## Global Show drafted control

- Added an off-by-default Show drafted switch to the sidebar header. It controls overall, position, and FLEX player tables and resets when changing drafts.
- Drafted rows remain inspectable, are dimmed and labeled Drafted, and retain disabled Pick actions. Drafted players without ECR and drafted players at filled positions can be shown. Existing filters, sorts, and row limits still apply.
- Recommendations and next-turn calculations remain available-player-only; this preference is separate UI state and is not a scoring input.
- Six focused integration tests, typecheck, lint, and production build passed. Tests exercise the real sidebar switch across overall/RB/FLEX tables, filled QB coverage, disabled pick actions, and hiding rows again. Local preview rebuilt on port 3017.
- Chrome verification: toggle on revealed three drafted rows, including Jahmyr Gibbs and Bijan Robinson; toggle off removed all drafted rows. No draft actions were taken.

## Collapsible recommendations

- Recommendations now has a collapse control, open by default. Collapsing hides both the current recommendations and next-turn preview while leaving player tables available.
- The sidebar Recommendations link reopens the section, including when the current URL hash already points to it.
- Typecheck, focused lint, and production build passed. Rebuilt and restarted port 3017, then reloaded the owner's Chrome tab. Its DOM confirms the new collapse control, Show drafted switch, and content-width tables.

## League starter-needs ratios

- Sidebar league needs now shows remaining/total starter slots per position, such as QB 11/12 and RB 23/24. FLEX has its own shared slot total.
- Denominators use league team count multiplied by the configured roster slot count, not one slot per position by assumption. The existing remaining-needs calculation is unchanged.
- Renamed the description to Starter needs remaining. Missing counts display an em dash.

## Single title-level sidebar toggle

- Moved the sole sidebar toggle to the left of the Draft Assistant title. Removed the lower Draft & team toolbar and the sidebar's internal collapse button.
- Placed the title and draft context bar inside the shared workspace layout so both move with the sidebar without separate margin rules.
- Typecheck, lint, build, and eight focused tests passed. Added assertions for one toggle beside the title and no internal sidebar trigger. Verified collapse and expand in the owner's Chrome tab after rebuilding/restarting localhost and reloading it.

## Drafted-row sort correction

- Found that missing current ADJ scores sent drafted rows to the end of an ADJ-sorted pool, below the visible row limit.
- Revealing drafted rows now switches an ADJ sort to descending VAL. Other selected sorts are preserved. Newly mounted tables also use VAL when drafted rows are visible. Users can still choose another sort explicitly.
- ADJ remains missing for drafted players; no historical or synthetic recommendation scores are invented. Pick actions remain disabled.
- Integration verification now checks that the higher-VAL drafted player appears first in overall, RB, and FLEX tables, with VAL marked as the active sort.

## Persistent draft-page preferences

- Added validated local-storage preferences for Sleeper/FP source, Show drafted, sidebar visibility, sidebar group visibility, Recommendations visibility, Overall visibility, position filters, and each table's sort column/direction.
- Preferences use the `fantasy-tiers:draft:` namespace and apply across drafts on the same browser origin. Mobile drawer opening remains temporary. Player selections, picks, and dialog state are not saved as preferences.
- Storage is read after hydration. Invalid values use defaults; blocked reads/writes do not stop session controls. Saved FP preference does not substitute another source when FP data is unavailable.
- Removed automatic initial hash expansion of Overall so a saved collapsed state survives refresh. Explicit sidebar navigation still opens the target.
- Verification: typecheck, lint, build, four focused component tests and one storage failure/validation test passed. Isolated Chrome confirmed all eight preference categories survive full reload. Rebuilt port 3017 and refreshed the owner's tab.

## Available-player row limits

- Table limits now count undrafted players only. Drafted rows retain their sorted positions above the next unavailable-page cutoff and add to the visible total.
- Show more / Show all controls count remaining undrafted rows as well.
- Eight table tests, typecheck, lint, and build passed. Live Chrome verification with Show drafted on: Overall 20 available + 3 drafted; RB 10 + 2; WR 10 + 1; FLEX 10 + 3. Localhost rebuilt and tab refreshed.

## Position rank beside names

- Overall/position/FLEX player rows and current/next-turn recommendations now show FantasyPros position rank beside the name (RB1, RB10). Missing or invalid ranks show the position followed by an em dash; the tooltip identifies the rank source.
- Recommendation tables retain the overall tier column and add a compact actual-position tier line below each name, such as Tier (RB) 1.
- No score, tier, rank, or recommendation calculation changed. Six focused tests, typecheck, lint, and build passed. Chrome verified Gibbs RB1, Robinson RB2, McCaffrey RB3, and recommendation position tiers. Localhost rebuilt and owner tab refreshed.

## Remove sidebar overflow menu

- Removed the three-dot Draft menu and its Refresh data and Change draft items from the sidebar. Removed unused menu/icon imports and data bindings.

## Watch list replaces manual comparison

- Removed the selected-comparison section, score-difference columns, three-player cap, and old comparison module.
- Added Watch list using the overall PlayerTable columns, source values, tiers, ranks, sorting, draft state, and shared details dialog. Empty state stays compact. Drafted watched players stay marked and inspectable.
- Added far-right +/− actions to overall, position, FLEX, current recommendation, next-turn, and watch-list rows. All actions share the same membership state. Player details now uses Watch +/− instead of Compare.
- Added a sidebar Watch list link. Membership persists as validated player IDs per draft in local storage; source and score changes read current canonical rows.
- Typecheck, lint, build, and focused tests passed. Full suite had 522 passes plus two timing failures during concurrent build load; the two affected files then passed all six tests with one worker.
- Isolated Chrome verified recommendation add, far-right placement, refresh persistence, position-table add, watch-list removal, removal of the old comparison section, and mobile page width. Screenshot: `/private/tmp/fantasy-tiers-screenshots/watch-list-desktop.png`.
- Localhost rebuilt on 3017. The owner's tab could not be reloaded because another browser session currently owns it; no session takeover was attempted.

## Focused polish pass

- Replaced the repeated user/settings header with the draft name and one Setup dialog. Kept scoring settings and change actions in Setup.
- Merged sidebar status into one block. Removed the Draft status group and the repeated Open sentence. Kept urgent completion warnings and update Retry.
- Labeled team counts as filled and league counts as open. Moved league needs above the roster. Hid the empty RB/WR ratio and compressed the empty bench.
- Aligned navigation in a grid, matched position order to the page, and marked selected links. Used D/ST labels. Group chevrons now reflect state.
- Joined source buttons. Moved attribution and errors into source details. Pending FP requests show loading, not unavailable.
- Shortened recommendation reasons to actual component differences; removed generic alternative prose and raw pick numbers. Used one Lead label.
- Renamed the future table Next-pick scenario. Kept market-order assumptions accessible. Added shared player dialogs and status indicators.
- Matched table borders, numeric precision and alignment. Used source display names without changing normalized scoring inputs. Kept missing values missing.
- Removed repeated team counts and shared FLEX demand from position subtitles. Showed open starters as a ratio. Made Show all controls compact.
- Separated watch-list sorting storage from Overall. Added keyboard buttons to sort headers, larger mobile watch targets, readable drafted rows, a sticky title control, and the standard mobile close button.
- Marked the selected row in player source details. Stated the direction and size of the largest adjustment. Shortened expanded news text.

Verification: 12 focused table/watch-list/dialog tests passed, plus 3 unchanged choice-policy tests. Typecheck and targeted lint passed. Production build and isolated Chrome checks passed at desktop and 390px mobile widths: Setup, keyboard sorting, next-pick detail opening, selected source, sticky trigger, mobile dismissal, and no page overflow or browser errors. No scoring, eligibility, recommendation selection, or source data changed. Parallel ESPN files were left untouched. Local preview uses port 3017; no push or deployment.

## Projection rank correction during UI trials

- Position badges now rank selected-source league-scored PTS across the full pool, including drafted players. Equal projections share a rank; missing source data shows a dash. They are projection ranks, not expert ranks or ADJ order.
- Existing overall, position, and FLEX tiers are labeled FP Tier. Tier calculations remain unchanged.
- Recommendation scoring and eligibility remain unchanged. FP D/ST still uses Sleeper projections. Scenario-detail/current-board mismatch and market-column semantics remain separate follow-up items.
