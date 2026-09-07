# FantasyPros public API — verified September 7, 2026

## Key storage
The key is in ignored .env.local as FANTASYPROS_API_KEY (permissions 0600). No NEXT_PUBLIC variable, GitHub secret, scheduled job, or app request uses it. Do not copy the key into this document.

## Limits and terms
- Owner-provided key approval notice: **50 requests/day**, truncated responses, personal non-commercial use, cache data rather than poll.
- Public API docs: https://api.fantasypros.com/public/v2/docs
- Machine-readable specification: https://api.fantasypros.com/public/v2/docs/fantasypros_v2_public.yml
- Terms: https://api.fantasypros.com/public/v2/terms-of-use
- The linked terms PDF is dated October 27, 2020. It says one call per second and 100 calls/day. Use the stricter key-specific allowance of **50/day**, not the older generic number.
- The terms restrict use to personal non-commercial purposes, prohibit sharing API access, require attribution for published analysis, and contain a non-compete clause. Do not wire this personal key into a public service.

## One-request test
Endpoint: GET /public/v2/json/nfl/2026/projections?positions=QB:RB:WR:TE&week=0

week=0 is the documented preseason value. One authenticated request returned HTTP 200, reported count 543, but only 10 player objects. All 10 were QB. No quota headers were returned. This demonstrates truncation for this request; it does not establish truncation details for every endpoint. Do not attempt to reconstruct the full paid dataset through repeated player filters.

Verdict: this response is not sufficient for the full draft-pool comparison or positional replacement baselines. Do not replace the complete browser snapshot with it.

Private saved evidence: data/fp-api/preseason-probe.json and probe-summary.json. Request ledger: data/fp-api/probe-usage.json. These are ignored. This agent made one authenticated request; usage elsewhere on the account is not measured.

Probe command: node --import=tsx scripts/fp/probe-public-api.ts
The probe reserves its attempt before networking, uses an exclusive lock, has no automatic retries, and rejects another attempt within 24 hours. It does not fetch when the draft page polls or reloads. Run it from the shared repository only so all local attempts use the same ledger. Do not schedule it or duplicate its ledger across machines.

## Session-backed refresh

On September 7, the owner authorized storing the signed-in FP session as GitHub `FP_COOKIE`. The existing website scraper returned 526 complete season rows in a hosted Actions run. This is separate from the truncated public API and does not use the API key. See `native-projection-release-2026-09-07.md` for counts, failure-preservation tests, and release status.
