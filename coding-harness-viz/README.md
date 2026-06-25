# Coding Harness Viz

A pixel-art visualization of the Multica issue lifecycle pipeline.

## Quick Start

```bash
cd coding-harness-viz
cp .env.example .env
# Edit .env with your GITHUB_TOKEN
pnpm install
pnpm dev
```

BFF starts on http://localhost:3300, frontend on http://localhost:5173.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | Yes | - | GitHub PAT for API access (avoid rate limiting) |
| `GITHUB_OWNER` | Yes | - | GitHub repo owner |
| `GITHUB_REPO` | Yes | - | GitHub repo name |
| `DEPLOY_WORKFLOW_FILE` | No | `deploy.yml` | Deploy workflow filename |
| `MULTICA_WORKSPACE_ID` | No | - | Multica workspace ID |

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- `multica` CLI installed and logged in locally
- `GITHUB_TOKEN` set in `.env` (avoids 60 req/hr unauthenticated limit)

## Project Structure

```
coding-harness-viz/
├── apps/
│   ├── web/        # Vite + React 18 + TypeScript frontend
│   └── bff/        # Fastify + TypeScript BFF
├── packages/
│   └── shared/     # Shared FSM & API types
├── .env.example
└── README.md
```

## Architecture

- **BFF** (`apps/bff`): Aggregates data from `multica` CLI (issues, comments, metadata) and GitHub API (PR state, CI, deploy workflows). Implements FSM state derivation (S1-S6). In-memory caching: 5s for Multica, 10s for GitHub.
- **Frontend** (`apps/web`): React SPA with pixel-art design. Polls BFF every 7s with etag support. Pauses polling when tab is hidden.

## FSM States

| State | Label | Entry Condition |
|-------|-------|----------------|
| S1 | Issue Created | Issue exists in Multica |
| S2 | Agent Picked Up | Agent assigned to issue |
| S3 | Coding | PR URL found in comments/metadata |
| S4 | PR Opened | PR approved (non-draft) |
| S5 | PR Merged | PR merged |
| S6 | Deployed | Deploy workflow succeeded |

## Limitations

- GitHub API rate limit: 5000 req/hr with token, 60 without
- Requires local `multica` CLI authentication
- No write operations (read-only visualization)
- S4 review decision parsing is simplified (PR open + non-draft = S4)

## BFF Mock Mode

For e2e testing without real Multica/GitHub dependencies, the BFF supports a `--mock-fixture` mode that serves pre-defined FSM snapshots from a JSON file:

```bash
cd apps/bff
npx tsx src/index.ts --mock-fixture test/fixtures/ac-01-issue-created.json
```

Mock fixtures live in `apps/bff/test/fixtures/`. Each fixture defines:
- `issues`: the issue list returned by `/api/issues`
- `harness`: the initial FSM snapshot for `/api/issues/:id/harness`
- `transitions` (optional): timed state changes that fire after N seconds

## E2E Regression Tests

Playwright e2e tests cover 3 main paths (AC-01, AC-05, AC-06):

```bash
cd coding-harness-viz
pnpm install
npx playwright install chromium
pnpm test:e2e
```

Each test suite starts BFF in mock mode with its fixture, then runs the Playwright tests against the frontend.

## Acceptance Criteria Covered

- AC-01: New issue lights up S1 node with heartbeat animation
- AC-02: Agent pickup transitions to S2 with assignee in sidebar
- AC-03: Coding state shows PR URL and draft badge
- AC-05: PR merge triggers firework animation
- AC-06: Deploy success triggers rocket animation, S6 highlighted
- AC-11: Clicking issue tab switches pipeline within 300ms, URL syncs
