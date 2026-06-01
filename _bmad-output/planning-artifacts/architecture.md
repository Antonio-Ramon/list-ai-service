---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-list-ai-service-2026-05-31/prd.md
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-06-01'
project_name: 'list-ai-service'
user_name: 'Antonio Ramon'
date: '2026-05-31'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (16 total):**

- *Image Upload & Validation (FR-001–004):* Accepts `multipart/form-data` with field `image`; validates JPEG/PNG/WEBP formats and 10 MB size limit; rejects with typed error codes and HTTP 400.
- *AI Extraction (FR-005–010):* Sends image + structured prompt to Anthropic Vision API; expects clean JSON (no markdown); extracts name, quantity, unit per item; discards items with name < 3 chars; retries up to 2× on AI failure.
- *Output Formatting (FR-011–013):* Returns `{ success, text, items[], total_items }`; supports `format` query param (`asterisk` default, `checklist`); `items[]` always returned regardless of format.
- *Rate Limiting (FR-014):* 10 req/min per IP; HTTP 429 on excess.
- *Observability (FR-015–016):* Structured logs per request and per AI failure.

**Non-Functional Requirements:**

- *Cost (NFR-001–002):* < US$0.02/request; concise prompts; no image pre-processing by default.
- *Performance (NFR-003):* < 10s total response time.
- *Security (NFR-004–005):* API key via env only; images not persisted.
- *Reliability (NFR-006):* Retry on AI transient failures (max 2 attempts).
- *Deploy (NFR-007):* Railway via `npm start`, no Dockerfile.

**Scale & Complexity:**

- Primary domain: API / Backend (Node.js)
- Complexity level: Low — lean MVP, single endpoint, stateless
- Estimated architectural components: ~6 discrete units

### Technical Constraints & Dependencies

- Runtime: Node.js (Railway-compatible, `npm start` entrypoint)
- External dependency: Anthropic Claude Vision API (sole integration point)
- No database, no auth, no image storage
- Environment-only configuration (`ANTHROPIC_API_KEY`, `PORT`, `MAX_FILE_SIZE_MB`, `NODE_ENV`)

### Cross-Cutting Concerns Identified

- **Error envelope uniformity:** All error responses share `{ success: false, error: CODE, message: string }` shape
- **Structured logging:** Every request emits a log record regardless of outcome
- **Secret hygiene:** API key must never appear in logs or error messages
- **Cost observability:** Token usage tracked per request to catch budget drift early

## Starter Template Evaluation

### Primary Technology Domain

API / Backend (Node.js + TypeScript) — confirmed by existing `package.json` and PRD deployment target (Railway, `npm start`).

### Technical Preferences Confirmed

- **Language:** TypeScript
- **Framework:** Fastify
- **Deploy target:** Railway (no Dockerfile, `npm start` entrypoint)

### Starter Approach: Manual Fastify Setup

No official scaffold covers this use case (Fastify + TypeScript, no database, single endpoint). The starter is a hand-assembled package foundation — appropriate for an API of this scope.

### Selected Stack: Fastify 5 + TypeScript

**Rationale for Selection:**

- Built-in pino logger satisfies NFR-015/016 (structured per-request logging) with zero extra packages
- `@fastify/multipart` is the official, actively maintained multipart plugin (covers FR-001)
- `@fastify/rate-limit` covers FR-014 in ~5 lines of configuration
- Fastify ships its own TypeScript types — no `@types/fastify` needed
- Railway has an official Fastify deployment guide and one-click template
- Fastify 5.8.5 is the current stable line (2026)

**Initialization Commands:**

```bash
npm install fastify@^5.8.5 @fastify/multipart@^10.0.0 @fastify/rate-limit@^10.3.0 @anthropic-ai/sdk@^0.100.1
npm install -D typescript tsx @types/node
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript 5.x. `tsx` for development (zero-compile execution). `tsc` → `dist/` for production build. Node.js target: ES2022 (Railway-compatible).

**HTTP & Routing:**
Fastify 5 plugin system — each cross-cutting concern (multipart, rate-limit) is a registered plugin. Routes defined as typed handler modules.

**Logging:**
pino (bundled with Fastify) — structured JSON in production (`NODE_ENV=production`), pretty-printed in development. Directly satisfies NFR-015 and NFR-016 without additional packages.

**Build Tooling:**
- Dev: `tsx src/index.ts` (hot-reload via `tsx --watch`)
- Build: `tsc`
- Start: `node dist/index.js`
- `package.json` scripts: `dev`, `build`, `start`

**Testing Framework:**
Not selected in starter — deferred to implementation stories. Recommended candidate: `vitest` (native TypeScript, fast, no transpile step).

**Code Organization:**

```
src/
  index.ts                — Fastify instance, plugin registration, server start
  routes/
    extract.ts            — POST /extract route handler
  services/
    ai-client.ts          — Anthropic SDK wrapper + retry logic (FR-010)
    formatter.ts          — output text formatting (FR-011/FR-012)
  middleware/
    image-validator.ts    — file type + size guard (FR-002/FR-003)
  types/
    index.ts              — shared TypeScript interfaces (Item, ApiResponse)
```

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Custom global error handler — enforces PRD error envelope from day 1
- CORS configuration — required for API to be callable from any client
- OpenAPI schema-first routing — shapes how every route handler is written

**Important Decisions (Shape Architecture):**
- Node.js 24 LTS — runtime target for all dev and CI environments
- GitHub Actions CI/CD — gates deployments with lint + build validation
- OpenAPI / Swagger UI — machine-readable contract at `/documentation`

**Deferred Decisions (Post-MVP):**
- External APM / error tracking (Sentry etc.) — logs sufficient for MVP
- Auth strategy — explicitly out of scope (PRD Section 8)
- Response caching — no repeated identical requests expected in MVP

---

### Data Architecture

**Decision:** No data layer.

The service is fully stateless. No database, no cache, no session storage. Every request is independent; the only persistent state is the `ANTHROPIC_API_KEY` environment variable loaded at startup. Rationale: PRD Section 8 explicitly excludes persistence.

---

### Authentication & Security

**Decision:** No authentication middleware.

The MVP exposes a public endpoint — auth is out of scope (PRD Section 8). Security posture is limited to:

| Concern | Decision |
|---|---|
| API key exposure | `ANTHROPIC_API_KEY` via env only; scrubbed from all logs (NFR-004) |
| Image persistence | Images not written to disk or retained beyond the request lifecycle (NFR-005) |
| Input validation | File type + size enforced at the Fastify route level via `@fastify/multipart` limits |
| CORS | `@fastify/cors@^11.2.0` — wide-open (`origin: '*'`) for MVP; tighten post-MVP |

**Cascading implication:** The `ANTHROPIC_API_KEY` must be redacted in the pino serializer config to prevent accidental logging of the env object.

---

### API & Communication Patterns

**Decision 1 — API style:** REST, single resource endpoint.
- `POST /extract` — the only route in the MVP
- Response contract defined in PRD FR-011 / FR-012

**Decision 2 — OpenAPI documentation:**
- `@fastify/swagger@^9.7.0` + `@fastify/swagger-ui@^5.2.5`
- Served at `GET /documentation`
- Route schemas defined as Fastify JSON Schema objects (inline with route definition)
- OpenAPI spec version: 3.0
- Rationale: provides a machine-readable contract for external integrators and doubles as living documentation

**Cascading implication:** Every route handler must declare a `schema` block with `body`/`querystring`/`response` shapes. This is the Fastify-native pattern and adds no overhead — schemas also drive Fastify's built-in serialization.

**Decision 3 — Global error handler:**
- `fastify.setErrorHandler()` registered in `src/index.ts`
- Normalises all unhandled errors to the PRD envelope:
  ```json
  { "success": false, "error": "ERROR_CODE", "message": "Human-readable string" }
  ```
- Specific error codes (`INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `NO_ITEMS_FOUND`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`) thrown as typed Fastify errors from route handlers and middleware
- Rationale: single enforcement point for FR-004; prevents shape drift across routes

**Decision 4 — Rate limiting:**
- `@fastify/rate-limit@^10.3.0` — 10 req/min per IP (FR-014)
- Returns HTTP 429 with `RATE_LIMIT_EXCEEDED` error code via the global error handler

---

### Frontend Architecture

**Decision:** N/A — API-only service.

---

### Infrastructure & Deployment

**Decision 1 — Node.js version:** 24 LTS (Active)
- `"engines": { "node": ">=24" }` in `package.json`
- `.nvmrc` → `24` for local dev consistency
- Rationale: Active LTS line with 2-year support window; V8 improvements over 22

**Decision 2 — CI/CD: GitHub Actions**
- Pipeline: lint → build (`tsc --noEmit`) → (tests when added)
- Triggers: push to `main`, pull requests
- Node.js matrix: 24.x
- Railway deploy: triggered automatically on successful push to `main` (Railway GitHub integration, not via Actions)
- Rationale: lint and type-check gates prevent broken builds reaching Railway

`.github/workflows/ci.yml` skeleton:
```yaml
name: CI
on: [push, pull_request]
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

**Decision 3 — Monitoring:** Logs only (pino + Railway dashboard)
- pino structured JSON logs in production satisfy NFR-015 / NFR-016
- Railway surfaces logs natively; no external agent needed for MVP
- Deferred: Sentry or similar if error-rate visibility becomes necessary

---

### Decision Impact Analysis

**Updated Initialization Commands (complete):**

```bash
npm install fastify@^5.8.5 @fastify/multipart@^10.0.0 @fastify/rate-limit@^10.3.0 \
  @fastify/cors@^11.2.0 @fastify/swagger@^9.7.0 @fastify/swagger-ui@^5.2.5 \
  @anthropic-ai/sdk@^0.100.1
npm install -D typescript tsx @types/node
```

**Implementation Sequence (derived from decisions):**

1. Project init: package.json, tsconfig.json, .nvmrc, .github/workflows/ci.yml
2. Fastify server: index.ts with plugin registration order:
   cors → rate-limit → multipart → swagger → swagger-ui → routes → error handler
3. Route schema: POST /extract JSON Schema (drives both validation + OpenAPI spec)
4. Image validator middleware
5. AI client service (Anthropic SDK + retry)
6. Formatter service
7. Global error handler

**Cross-Component Dependencies:**

- OpenAPI schemas must be defined before routes are registered (Fastify requirement)
- Global error handler must be registered after all plugins but captures errors from all of them
- pino serializer config (to redact API key) must be set at Fastify instance creation

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

8 areas where AI agents could make incompatible choices in this codebase.

---

### Naming Patterns

**File Naming — kebab-case for all source files:**

```
src/routes/extract.ts              ✅
src/services/ai-client.ts          ✅
src/middleware/image-validator.ts   ✅
src/types/index.ts                 ✅

src/services/aiClient.ts           ❌
src/services/AiClient.ts           ❌
```

Rationale: kebab-case is case-insensitive-safe across macOS, Linux, and Windows.

**TypeScript Types & Interfaces — PascalCase:**

```ts
interface ExtractResponse { ... }              ✅
interface Item { ... }                         ✅
type ErrorCode = 'INVALID_FILE_TYPE' | ...     ✅

interface extractResponse { ... }              ❌
```

**Functions & Variables — camelCase:**

```ts
async function extractItems() {}   ✅
const totalItems = items.length;   ✅

async function extract_items() {}  ❌
```

**Environment-derived constants — SCREAMING_SNAKE_CASE, defined in `config.ts` only:**

```ts
// src/config.ts
export const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB ?? 10);  ✅
```

**Error code strings — SCREAMING_SNAKE_CASE literals:**

```ts
'INVALID_FILE_TYPE'   ✅
'invalidFileType'     ❌
'invalid_file_type'   ❌
```

---

### API Response Format — strict PRD contract, no deviations

The PRD defines the exact field names. Agents MUST NOT rename or reformat these:

```ts
// Success shape (FR-011)
interface ExtractResponse {
  success: true;
  text: string;        // formatted list string
  items: Item[];       // always present (FR-013)
  total_items: number; // snake_case — matches PRD exactly, do NOT change to totalItems
}

// Item shape (FR-007)
interface Item {
  name: string;
  quantity: number;
  unit: string;
}

// Error shape (FR-004)
interface ErrorResponse {
  success: false;
  error: ErrorCode;    // SCREAMING_SNAKE_CASE string
  message: string;     // human-readable, in Portuguese (matches PRD target audience)
}
```

**Anti-pattern:**

```ts
total_items: items.length  ✅
totalItems: items.length   ❌  // breaks PRD contract
```

---

### Structure Patterns

**Centralized env/config access — always via `src/config.ts`:**

All environment variables are read ONCE in `src/config.ts` and exported as typed constants.
No file other than `config.ts` may reference `process.env` directly.

```ts
// src/config.ts  ✅
export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  port: Number(process.env.PORT ?? 3000),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};

// src/services/ai-client.ts  ✅
import { config } from '../config.js';

// src/services/ai-client.ts  ❌
const apiKey = process.env.ANTHROPIC_API_KEY;
```

Rationale: prevents accidental key logging; single place to add startup validation.

**Test file co-location — `*.test.ts` next to the source file:**

```
src/services/ai-client.ts
src/services/ai-client.test.ts     ✅

src/__tests__/ai-client.test.ts    ❌
tests/ai-client.test.ts            ❌
```

---

### Process Patterns

**Error throwing — typed factory from `src/errors.ts`, never raw `new Error()`:**

```ts
// src/errors.ts — single source of typed errors
import createError from '@fastify/error';

export const InvalidFileTypeError = createError('INVALID_FILE_TYPE', '%s', 400);
export const FileTooLargeError    = createError('FILE_TOO_LARGE', '%s', 400);
export const NoItemsFoundError    = createError('NO_ITEMS_FOUND', '%s', 422);
export const InternalError        = createError('INTERNAL_ERROR', '%s', 500);

// Usage in route/middleware  ✅
throw new InvalidFileTypeError('Formato de arquivo inválido. Use JPEG, PNG ou WEBP.');

// Anti-pattern  ❌
throw new Error('invalid file type');
```

The global `setErrorHandler` reads the typed error's `statusCode` and `code` fields
to build the response envelope automatically.

**Retry logic — owned exclusively by `ai-client.ts`:**

The route handler calls `aiClient.extract(imageBuffer, mimeType)` and never implements
retry itself. The retry loop (max 2 attempts on 5xx / timeout) lives only in `ai-client.ts`.

```ts
// src/routes/extract.ts  ✅
const items = await aiClient.extract(imageBuffer, mimeType);

// src/routes/extract.ts  ❌
for (let attempt = 0; attempt < 3; attempt++) { ... }
```

**Async pattern — `async/await` only, no `.then()` chains:**

```ts
const result = await aiClient.extract(buffer, mime);              ✅
aiClient.extract(buffer, mime).then(result => { ... })            ❌
```

Rationale: ensures errors propagate correctly into the global Fastify error handler.

**TypeScript strictness — `strict: true` in tsconfig.json:**

All files must compile with zero errors under strict mode.
No `// @ts-ignore` or `any` casts without an explanatory comment.

---

### Enforcement Guidelines

**All AI Agents MUST:**

- Read env vars only via `src/config.ts` — never `process.env` directly in other files
- Throw typed errors from `src/errors.ts` — never raw `new Error()`
- Keep retry logic inside `ai-client.ts` — never in route handlers
- Use the exact JSON field names from the PRD — especially `total_items` (not `totalItems`)
- Use `async/await` exclusively — no `.then()` chains
- Name source files in `kebab-case.ts`
- Co-locate test files as `*.test.ts` next to their source file

**Pattern Verification:**

- `strict: true` in tsconfig catches null safety violations at build time
- ESLint `no-process-env` rule enforces `config.ts`-only env access
- Global error handler surfaces shape violations at runtime (wrong field names produce wrong body — caught by integration tests)

## Project Structure & Boundaries

### Complete Project Directory Structure

```
list-ai-service/
├── .env.example                  — env var template (committed; no secrets)
├── .gitignore
├── .nvmrc                        — "24" (Node.js version pin)
├── package.json                  — engines: { node: ">=24" }, scripts: dev/build/start
├── package-lock.json
├── tsconfig.json                 — strict: true, target: ES2022, outDir: dist
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml                — lint + build gate on push/PR
└── src/
    ├── index.ts                  — Fastify instance, plugin registration, server start
    ├── config.ts                 — sole access point for all process.env reads
    ├── errors.ts                 — typed error factories (InvalidFileTypeError, etc.)
    ├── routes/
    │   └── extract.ts            — POST /extract: JSON schema, handler, orchestration
    ├── services/
    │   ├── ai-client.ts          — Anthropic SDK wrapper + retry logic (FR-005–010)
    │   ├── ai-client.test.ts
    │   ├── formatter.ts          — text output builder: asterisk/checklist (FR-012)
    │   └── formatter.test.ts
    ├── middleware/
    │   ├── image-validator.ts    — MIME type + file size guard (FR-002/003)
    │   └── image-validator.test.ts
    └── types/
        └── index.ts              — ExtractResponse, Item, ErrorResponse, ErrorCode
```

_(gitignored: `dist/`, `node_modules/`, `.env`)_

---

### Architectural Boundaries

**External Boundary — Anthropic Vision API:**

- Crossing point: `src/services/ai-client.ts` exclusively
- Transport: HTTPS managed by `@anthropic-ai/sdk`
- Failure modes: timeout / 5xx → retry (max 2 attempts) → throw `InternalError`
- The route handler never touches the Anthropic SDK directly

**Internal Component Boundaries:**

```
HTTP Request
    │
    ▼
@fastify/rate-limit (src/index.ts)     — blocks at 10 req/min/IP
    │
    ▼
@fastify/multipart (src/index.ts)      — parses multipart/form-data
    │
    ▼
image-validator.ts (middleware)        — validates MIME type + file size
    │
    ▼
extract.ts (route handler)             — orchestrates services, builds response
    ├──▶ ai-client.ts (service)        — calls Anthropic, retries, filters items
    └──▶ formatter.ts (service)        — formats items[] into text string
    │
    ▼
Global setErrorHandler (src/index.ts)  — normalises all errors to PRD envelope
```

**Configuration Boundary:**

`src/config.ts` is the only file that reads `process.env`. All other modules import
from config. This enforces NFR-004 (API key never leaks into logs) and ensures startup
validation is centralised.

---

### Requirements to Structure Mapping

| Requirement | File | Notes |
|---|---|---|
| FR-001 (multipart accept) | `src/index.ts` + `src/routes/extract.ts` | Plugin registered globally; route declares `consumes: multipart/form-data` in schema |
| FR-002/003 (type + size) | `src/middleware/image-validator.ts` | Called first inside route handler |
| FR-004 (error envelope) | `src/errors.ts` + `src/index.ts` | Factory + global handler |
| FR-005–009 (AI + filter) | `src/services/ai-client.ts` | Prompt, parse, discard name<3 |
| FR-010 (retry) | `src/services/ai-client.ts` | Exclusively here |
| FR-011/013 (response shape) | `src/types/index.ts` + `src/routes/extract.ts` | Types enforce contract |
| FR-012 (format param) | `src/services/formatter.ts` | Pure function: items + format → text |
| FR-014 (rate limit) | `src/index.ts` | @fastify/rate-limit config |
| FR-015/016 (logs) | `src/index.ts` | pino config; per-request via Fastify hooks |
| NFR-004 (key redaction) | `src/index.ts` | pino serializer redacts API key from logs |

---

### Integration Points

**Data Flow (happy path):**

1. `POST /extract?format=asterisk` arrives with `multipart/form-data`
2. `@fastify/rate-limit` checks IP counter
3. `@fastify/multipart` buffers the `image` field into memory
4. `image-validator.ts` checks MIME type and byte length
5. `ai-client.ts` sends image buffer + prompt → receives raw JSON string → parses → filters (name < 3 chars)
6. If `items.length === 0` → throws `NoItemsFoundError` (HTTP 422)
7. `formatter.ts` builds `text` string from `items` using `format` param
8. Route returns `{ success: true, text, items, total_items: items.length }`

**Error Flow:**

Any throw in steps 3–7 is caught by `setErrorHandler`, which reads `err.statusCode`
and `err.code` from the typed error, then writes the PRD envelope to the response.

---

### File Organization Patterns

**Configuration files (root):**

```
tsconfig.json     — TypeScript compiler config
.nvmrc            — Node.js version for nvm/fnm
.env.example      — committed template listing all required vars
.gitignore        — dist/, node_modules/, .env
```

**Source organization:** flat services, not feature folders — justified because there
is only one feature. No nested module hierarchy needed.

**Test organization:** co-located `*.test.ts` files. No separate `tests/` directory.

**Build output:** `dist/` at project root (gitignored). Railway runs `node dist/index.js`
via `npm start`.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All `@fastify/*` plugins (multipart@10, rate-limit@10, cors@11, swagger@9, swagger-ui@5) are the Fastify 5-compatible major lines — no version conflicts. Node.js 24 LTS exceeds all package minimums (≥18). `@anthropic-ai/sdk@0.100.1` is runtime-agnostic and compatible with any Node.js 18+.

**Pattern Consistency:**
- kebab-case file naming applied uniformly across all `src/` directories
- Typed error factory pattern in `errors.ts` is coherent with `setErrorHandler` in `index.ts`
- `config.ts` single access point is coherent with pino redaction decision and NFR-004
- `async/await` pattern aligns with Fastify's native async handler model
- `strict: true` TypeScript enforces the `total_items` snake_case contract at compile time

**Structure Alignment:**
The flat `src/` structure (no nested feature modules) is appropriate and intentional for a single-endpoint service. All architectural decisions have a named home in the directory tree. No structural orphans found.

---

### Requirements Coverage Validation ✅

**Functional Requirements — all 16 covered:**

| FR | Status | File |
|---|---|---|
| FR-001 | ✅ | `src/index.ts` + `src/routes/extract.ts` |
| FR-002/003 | ✅ | `src/middleware/image-validator.ts` |
| FR-004 | ✅ | `src/errors.ts` + `src/index.ts` (setErrorHandler) |
| FR-005/006 | ✅ | `src/services/ai-client.ts` (prompt design is impl. detail) |
| FR-007 | ✅ | `src/services/ai-client.ts` |
| FR-008 | ✅ | `src/services/ai-client.ts` → `NoItemsFoundError` |
| FR-009 | ✅ | `src/services/ai-client.ts` (filter name.length < 3) |
| FR-010 | ✅ | `src/services/ai-client.ts` (retry owned here exclusively) |
| FR-011/013 | ✅ | `src/types/index.ts` + `src/routes/extract.ts` |
| FR-012 | ✅ | `src/services/formatter.ts` |
| FR-014 | ✅ | `@fastify/rate-limit` in `src/index.ts` |
| FR-015/016 | ✅ | pino config in `src/index.ts` |

**Non-Functional Requirements — all 7 covered:**

| NFR | Status | Notes |
|---|---|---|
| NFR-001 (cost) | ✅ | Anthropic SDK returns `usage.input_tokens`/`output_tokens`; log in `ai-client.ts` |
| NFR-002 (no pre-processing) | ✅ | Buffer passed directly; no resize/compress |
| NFR-003 (< 10s) | ✅ | Anthropic SDK timeout configurable via `config.ts`; set to 8000ms |
| NFR-004 (key not logged) | ✅ | pino serializer redaction + `config.ts` boundary |
| NFR-005 (no image persistence) | ✅ | `@fastify/multipart` memory-only; no disk write |
| NFR-006 (retry) | ✅ | `ai-client.ts` exclusive ownership |
| NFR-007 (Railway npm start) | ✅ | `dist/index.js` via `tsc`; no Dockerfile |

---

### Gap Analysis Results

**Critical Gaps: None.**

**Important Gaps Resolved:**

- `@fastify/error` was missing from initialization commands — **corrected** (see updated commands below). This package provides the `createError` factory used in `src/errors.ts`.

**Minor Gaps (implementation-level, not structural):**

- Anthropic SDK timeout value: set to `8000ms` in `config.ts` to leave 2s buffer for Fastify overhead within the 10s NFR-003 target. Document in implementation.
- pino redaction fields: `['req.headers.authorization', 'ANTHROPIC_API_KEY']` — configure at Fastify instance creation. Document in implementation.
- Token cost logging: use `response.usage.input_tokens` + `output_tokens` from the Anthropic SDK message response. Document in implementation.

---

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

---

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

All 16 checklist items confirmed. No critical gaps remain. The one important gap (`@fastify/error` missing from install commands) has been corrected inline.

**Confidence Level: High**

**Key Strengths:**
- Every FR and NFR maps to a named file — no ambiguity for implementing agents
- Typed error factory + global handler eliminates the most common shape-drift failure
- `config.ts` boundary enforces NFR-004 structurally, not just by convention
- pino built into Fastify eliminates a dependency decision that would otherwise vary
- Flat structure matches the project's actual complexity — no over-engineering

**Areas for Future Enhancement (post-MVP):**
- Add `@fastify/sensible` for richer HTTP helpers if endpoint count grows
- Introduce request-level tracing (`req.id` correlation in all log lines) if debugging becomes complex
- Restrict CORS origins once a known client set is established
- Add Sentry or similar APM if Railway logs prove insufficient for error triage

---

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns and consistency rules from this document
- Respect the component boundaries and data flow defined in Project Structure
- Refer to this document for all architectural questions before making decisions

**First Implementation Priority:**

```bash
# Story 1: Project initialization
npm install fastify@^5.8.5 @fastify/multipart@^10.0.0 @fastify/rate-limit@^10.3.0 \
  @fastify/cors@^11.2.0 @fastify/swagger@^9.7.0 @fastify/swagger-ui@^5.2.5 \
  @fastify/error@^4.0.0 @anthropic-ai/sdk@^0.100.1
npm install -D typescript tsx @types/node
```

Then: create `tsconfig.json`, `.nvmrc`, `.env.example`, `.gitignore`, `src/config.ts`, `src/errors.ts`, `src/types/index.ts`, and the `.github/workflows/ci.yml` skeleton before writing any route or service code.
