---
baseline_commit: NO_VCS
---

# Story 1.3: CI/CD Pipeline & Railway Deployment

Status: in-progress

## Story

As a developer,
I want an automated CI pipeline that validates every push and pull request, and a verified Railway deployment,
so that broken TypeScript never reaches production and deployments are fully automated.

## Acceptance Criteria

1. A push to any branch or an open PR triggers the GitHub Actions workflow, runs `npm ci` and `npm run build` on Node.js 24.x, and fails if TypeScript compilation fails.
2. A successful push to `main` triggers Railway to build and start the service via `npm start`; `PORT` is supplied by Railway; `ANTHROPIC_API_KEY` is a Railway secret variable (not committed).
3. `GET /documentation` on the Railway public URL returns HTTP 200 (Swagger UI), confirming the server is live.

## Tasks / Subtasks

- [x] Create `.github/workflows/ci.yml` (AC: 1)
  - [x] Trigger on `push` and `pull_request` for all branches
  - [x] Single job `build` running on `ubuntu-latest`
  - [x] Steps: `actions/checkout@v4`, `actions/setup-node@v4` (node-version: '24', cache: 'npm'), `npm ci`, `npm run build`
  - [x] The build step (`tsc`) implicitly validates TypeScript — workflow fails if build fails

- [ ] Connect Railway project (AC: 2) — manual steps (document here for reference)
  - [ ] Create new Railway project linked to the GitHub repository
  - [ ] Set start command: `npm start` (or Railway auto-detects from package.json `start` script)
  - [ ] Set environment variable `ANTHROPIC_API_KEY` as a Railway secret (never commit this value)
  - [ ] Railway auto-deploys on push to `main` via GitHub integration — no extra Actions step needed

- [ ] Verify CI pipeline (AC: 1)
  - [ ] Push a branch with intentional TypeScript error → confirm CI fails
  - [ ] Fix error and push again → confirm CI passes

- [ ] Verify Railway deployment (AC: 2, 3)
  - [ ] Push to `main` → Railway build triggered
  - [ ] `GET https://<railway-url>/documentation` → HTTP 200

## Dev Notes

**Prerequisite:** Stories 1.1 and 1.2 must be complete. This story requires a working `npm run build` and a server that starts via `npm start`.

**GitHub Actions CI/CD — exact `ci.yml`:**
```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

**Why `npm ci` not `npm install`:** `npm ci` enforces `package-lock.json` — reproducible installs in CI. Never use `npm install` in CI pipelines.

**Railway deployment — no Dockerfile required (NFR-007):**
- Railway detects Node.js project from `package.json`
- Uses `npm start` → `node dist/index.js`
- `PORT` env var is injected automatically by Railway — the server must listen on `process.env.PORT` (handled by `config.ts` from Story 1.1)
- Railway needs the `dist/` build output, so either:
  - Option A: Add a Railway build command: `npm run build` (Railway runs this before starting)
  - Option B: Include `dist/` in the repository (not recommended — adds build artifacts to git)
  - **Recommended: Option A** — set build command to `npm run build` in Railway project settings

**Railway environment variables:**
- `ANTHROPIC_API_KEY` — add as Railway secret (encrypted, not in git)
- `NODE_ENV=production` — set explicitly for pino JSON logging
- `PORT` — supplied automatically by Railway (do NOT set manually)
- `MAX_FILE_SIZE_MB` — optional, defaults to 10 if unset

**`host: '0.0.0.0'` is mandatory** in `fastify.listen()` (set in Story 1.2). Railway routes external traffic to the container's `0.0.0.0` — binding to `127.0.0.1` causes deployment failures even when the build succeeds.

**CI does not run tests yet** — no test framework was set up in this epic. The pipeline only validates TypeScript compilation. Tests are added when the test framework is introduced (post-MVP or per story).

**Secret hygiene verification (NFR-004):**
- `ANTHROPIC_API_KEY` MUST NOT appear in `.github/workflows/ci.yml` or any committed file
- It is set ONLY in Railway's encrypted secret store
- The CI pipeline does not need it (CI only runs `tsc`, not the server)

### Project Structure Notes

Files created by this story:
```
.github/
  workflows/
    ci.yml     ← NEW
```

No `src/` files are modified. This story is infrastructure-only.

### References

- [Source: architecture.md#Infrastructure & Deployment] — CI/CD decisions, Railway setup, Node.js 24
- [Source: architecture.md#Authentication & Security] — secret hygiene NFR-004
- [Source: epics.md#Story 1.3 Acceptance Criteria]
- [Source: PRD#NFR-007] — Railway deploy via `npm start`, no Dockerfile

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
