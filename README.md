This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Data Management

### Automated Data Updates

This project includes an automated workflow that fetches fresh fantasy football data every night at 2 AM UTC.

#### What's Updated

- **FantasyPros Rankings**: Player rankings and projections
- **Sleeper Projections**: Weekly projections and player metadata
- **Boris Chen Rankings**: Expert rankings across different scoring systems
- **Aggregated Data**: Combined rankings and statistics

#### Manual Data Updates

You can also trigger data updates manually:

```bash
# Fetch all data sources
pnpm run fetch:all

# Build aggregates from fetched data
pnpm run agg:all

# Validate data integrity
pnpm run validate:aggregates:ci
```

### FantasyPros data modes: Draft vs Weekly

You can build two flavors of FantasyPros data:

- Draft (preseason cheat sheets) — used before Week 1
- Weekly (current-week ECR by position) — used in-season

#### Build the Draft dataset (preseason)

```bash
# 1) Fetch FantasyPros in Draft mode only
DRAFT=true pnpm run fetch:fp

# 2) Build FantasyPros aggregate and combined shards
pnpm run agg:all
```

What this does:

- Scrapes FantasyPros draft projections and draft ECR for STD/HALF/PPR
- Writes raw files under `public/data/fantasypros/raw/`
- Writes `public/data/fantasypros/fantasypros_aggregate.json`
- Rebuilds per-position combined shards under `public/data/aggregate/`

#### Build the Weekly dataset (in-season, current week)

```bash
# 1) Fetch FantasyPros weekly data (current week only)
pnpm run fetch:fp

# 2) Build FantasyPros aggregate and combined shards
pnpm run agg:all
```

Notes:

- Weekly fetch scrapes current-week ECR per position/scoring from FantasyPros URLs (no `?week=` query).
- Sidecar metadata JSONs include `accessed` (as `last_scraped`) and `url`.
- A summary `public/data/aggregate/metadata.json` is produced during combine with per-scoring/per-position metadata:
  - `last_updated`, `total_experts`, `scoring`, `position_id`, `week`, `year`, `last_scraped`, `url`.

Optional (advanced): Fetch a specific week for ad‑hoc checks

```bash
# Example: RB PPR Week 2 (writes raw weekly files only)
node --import=tsx scripts/fp/scrape-ecr-adp.ts weekly RB PPR 2

# Then rebuild aggregates if desired
pnpm run agg:fp && pnpm run agg:combine
```

#### GitHub Actions Workflow

The automated workflow (`.github/workflows/fetch-data.yml`) runs nightly at 2 AM UTC and:

1. Fetches fresh data from all sources (FantasyPros, Sleeper, Boris Chen)
2. Builds aggregate rankings across all scoring systems (Standard, PPR, Half-PPR)
3. Validates data integrity using strict type checking
4. Commits only the processed aggregate data to git (raw provider data cached locally)

**Monitoring the Workflow:**

- Check the Actions tab in GitHub for workflow runs
- Look for commits with messages starting with "🤖 Automated data update"
- The workflow will skip commits if no data changes are detected

**Manual Triggers:**

- Go to Actions → "Fetch Fantasy Football Data" → "Run workflow"
- Or push to the repository to trigger on schedule

**Configuration:**

- Schedule: Every night at 2 AM UTC (adjustable in the workflow file)
- Data sources: FantasyPros, Sleeper, Boris Chen
- Scoring systems: Standard, PPR, Half-PPR

### Data Architecture

#### Data Flow Pipeline

```
Raw Data Sources → Validation → Aggregation → API → Hooks → UI
     ↓                ↓           ↓         ↓      ↓       ↓
  FantasyPros      Zod schemas  Scripts   Routes  React   Components
  + Sleeper       + TypeScript + Combine + Server + Query + Tables
  + Boris Chen     validation   + Clean  + Cache + Client + Filters
```

#### Key Components

**Schemas & Types** (`src/lib/schemas*.ts`):

- `PositionEnum`: QB, RB, WR, TE, K, DEF only (no individual positions like FB, CB)
- `FantasyProsCombined`: Requires `player_id: z.string().min(1)`
- `CombinedEntry`: Uses `PositionEnum` for type safety
- Runtime validation with Zod at all boundaries

**Data Sources**:

- **ALL file**: Complete player dataset from all sources (used by `/api/players`)
- **FLEX file**: Dedicated FLEX rankings (not derived from RB/WR/TE filtering)
- **Position files**: QB, RB, WR, TE, K, DEF (individual position rankings)

**Important**: FLEX and ALL data files should NOT be made by combining other position-specific data files. They contain unique rankings and projections specific to their context.

#### Position Tables Data Sources

Each position table **MUST** use its own dedicated data file. Do NOT derive per-position tables by filtering the ALL data file:

- QB: `public/data/aggregate/QB-combined-aggregate.json`
- RB: `public/data/aggregate/RB-combined-aggregate.json`
- WR: `public/data/aggregate/WR-combined-aggregate.json`
- TE: `public/data/aggregate/TE-combined-aggregate.json`
- K: `public/data/aggregate/K-combined-aggregate.json`
- DEF: `public/data/aggregate/DEF-combined-aggregate.json`
- FLEX: `public/data/aggregate/FLEX-combined-aggregate.json`
- ALL: `public/data/aggregate/ALL-combined-aggregate.json`

**Why?** Each file contains unique rankings, projections, and context-specific data that cannot be accurately derived by filtering other data files.

#### Development Commands

```bash
# Rebuild all aggregates from source data
pnpm agg:all

# Validate aggregate data integrity
pnpm validate:aggregates

# Full pipeline (rebuild + validate + test + lint)
pnpm agg:all && pnpm validate:aggregates && pnpm test && pnpm lint
```

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
