# Release closeout — September 6, 2026

Candidate: `29f5dfffdf18ba930760149a6602b099178c8982` in PR #23.

- Isolated checkout: `/private/tmp/fantasy-release-20260906`.
- Latest main data preserved byte for byte. ESPN extension and relay excluded; root work preserved.
- 505 local tests passed before the final fixes. 18 focused tests passed after the fixes, including two new API cases. Final GitHub unit and browser jobs passed.
- Typecheck, lint, production build, and four Python report tests passed. Vercel rebuilt the final commit.
- Review found a missing confirmed pre-draft flag in the view-model API. Fixed and covered through the real fetcher. CI found an undeclared ripgrep dependency in evidence hashing. Replaced with Git file enumeration.
- Final Codex review against `118f8416d8691f15f8f936b7f383af750e1a8dcc` exited 0 with no actionable findings.
- Preview health returned healthy for the exact candidate commit. Aggregate response passed the shared schema.
- Chrome: selected pair persisted across tabs; named pair gaps were correct; scenario was explicitly hypothetical; stress results stated conditional outcomes, not confidence. Robinson was visible initially; White and Jones were absent from the initial cards. The default remained Robinson.
- The paused mock stayed at 116 picks. No new Sleeper pick was submitted.

Production merged by the owner at 2026-09-07 04:49 UTC as `a9ba67340aa131b7b0fcd6f5090e3a660cf1cd06`. The deployment verification script confirmed this exact production commit, healthy data, and a schema-valid aggregate response. Chrome loaded the paused room at pick 117, with recommendations enabled, six intervening picks, and working selected comparisons across position tabs. No draft pick was submitted.
