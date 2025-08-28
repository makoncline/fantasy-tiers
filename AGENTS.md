# Repository Guidelines

## Project Structure & Modules
- `src/app/`: Next.js App Router (layouts, pages, API routes). Examples: `draft-assistant/`, `league-manager/`.
- `src/components/`: Reusable UI (e.g., `DraftAssistantForm.tsx`).
- `src/lib/`: Data scripts and utilities (`fetch*`, `parse*`, `aggregate*`, `schemas.ts`). Tests may live here (e.g., `first.test.ts`).
- `src/hooks/` and `src/contexts/`: React hooks and providers.
- `public/data/`: Generated JSON datasets used by the app. Large files—avoid manual edits.
- Root config: `next.config.{js,mjs}`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`.

## Build, Test, and Development
- `npm run dev`: Start the Next.js dev server.
- `npm run build`: Build production assets.
- `npm start`: Run the production build locally.
- `npm run lint`: Lint with Next.js + ESLint rules.
- `npm test` / `npm run test:run`: Run Vitest in node/jsdom.
- Data workflows:
  - `npm run fetch-data`: Download raw player/team/ranking data.
  - `npm run parse-data`: Parse and aggregate into `public/data/`.
  - `npm run fetch-ranking-data`: Update rankings only.

## Coding Style & Naming
- Language: TypeScript, React 18, Next.js 14 App Router.
- Style: ESLint `next/core-web-vitals`; 2-space indent; prefer named exports for libs; Next.js pages export `default`.
- Naming: Components `PascalCase` (`.tsx`), hooks start with `use*`, utilities `camelCase` (`.ts`).
- Tailwind: Keep classes readable and grouped logically.

## Testing Guidelines
- Framework: Vitest (`describe/it/expect`).
- Location: Co-locate as `*.test.ts` near source (e.g., `src/hooks/rosterUtils.test.ts`).
- Run: `npm test` for watch mode, `npm run test:run` for CI-style runs.

## Commit & Pull Requests
- Commits: Write clear, imperative messages. For automated data updates, keep "Automated data update". For features/fixes, use a short scope (e.g., `feat: draft assistant filtering`).
- PRs: Include purpose, linked issues, UI screenshots for visible changes, and notes on data or schema impacts. Ensure `npm run lint` and tests pass.

## Security & Configuration
- Do not commit secrets. Use `process.env.*` via `.env.local` (gitignored).
- Generated data can be large; prefer running scripts over manual edits and commit only necessary aggregates.
