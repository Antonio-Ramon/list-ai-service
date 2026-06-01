---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-list-ai-service-2026-05-31/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# list-ai-service - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for list-ai-service, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-001: The system must accept image uploads via `multipart/form-data` with field name `image`.
FR-002: Accepted formats: JPEG, PNG, WEBP. Any other format must be rejected with error `INVALID_FILE_TYPE` and HTTP 400.
FR-003: Maximum file size: 10 MB. Larger files must be rejected with error `FILE_TOO_LARGE` and HTTP 400.
FR-004: Error responses must return HTTP 4xx/5xx with `{ success: false, error: CODE, message: string }` — messages in Portuguese.
FR-005: The system must send the image to the Anthropic Vision API with a structured prompt for item extraction.
FR-006: The prompt must instruct the model to return exclusively valid JSON — no markdown, no extra text.
FR-007: For each item on the receipt, extract: `name` (cleaned Portuguese product name), `quantity` (numeric), `unit` (e.g. `un`, `kg`, `L`).
FR-008: If no items are identified, return HTTP 422 with error `NO_ITEMS_FOUND`.
FR-009: Discard any item whose `name` has fewer than 3 characters to eliminate invalid/hallucinated entries.
FR-010: On AI API failure (timeout or 5xx), perform up to 2 automatic retries before returning an error to the client.
FR-011: Successful responses must follow the contract: `{ success: true, text: string, items: Item[], total_items: number }`.
FR-012: The endpoint must accept an optional `format` query parameter: `asterisk` (default) or `checklist`, controlling the `text` field format.
FR-013: The `items` array must always be present in the response regardless of the `format` parameter chosen.
FR-014: Requests must be rate-limited to 10 per minute per IP. Excess requests return HTTP 429 with error `RATE_LIMIT_EXCEEDED`.
FR-015: The system must emit structured logs per request: timestamp, IP, file size, processing time, total items extracted, response status.
FR-016: AI API failures must be logged with error code, attempt number, and latency.

### NonFunctional Requirements

NFR-001: Cost per request must not exceed US$0.02. The prompt must be concise and without redundancy. Token consumption must be monitored via logs.
NFR-002: The system must not pre-process or resize images by default; the 10 MB limit is sufficient to control input token volume.
NFR-003: Total response time must be under 10 seconds under normal network conditions.
NFR-004: The API key must be loaded exclusively via the `ANTHROPIC_API_KEY` environment variable — never hardcoded or exposed in logs.
NFR-005: Received images must not be persisted to disk or memory beyond the lifecycle of the request.
NFR-006: The system must tolerate transient AI API failures with automatic retry (max 2 attempts).
NFR-007: The service must be startable via `npm start` and deployable on Railway directly from the Git repository, without a Dockerfile.

### Additional Requirements

- **Project initialization**: Install packages fastify@^5.8.5, @fastify/multipart@^10.0.0, @fastify/rate-limit@^10.3.0, @fastify/cors@^11.2.0, @fastify/swagger@^9.7.0, @fastify/swagger-ui@^5.2.5, @fastify/error@^4.0.0, @anthropic-ai/sdk@^0.100.1; dev: typescript, tsx, @types/node.
- **TypeScript strict mode**: `tsconfig.json` with `strict: true`, `target: ES2022`, `outDir: dist`.
- **Node.js version**: 24 LTS — pin via `.nvmrc` and `"engines": { "node": ">=24" }` in package.json.
- **Config boundary**: `src/config.ts` is the sole file allowed to read `process.env`. All other files import from config.
- **Typed error factory**: `src/errors.ts` defines typed error constructors using `@fastify/error` for all error codes.
- **Global error handler**: `fastify.setErrorHandler()` in `src/index.ts` normalises all errors to the PRD envelope.
- **Plugin registration order**: cors → rate-limit → multipart → swagger → swagger-ui → routes → error handler.
- **pino logging**: Structured JSON in production; pretty-printed in development. API key redacted from serializer.
- **Anthropic SDK timeout**: 8000ms (leaves 2s buffer for Fastify overhead within NFR-003).
- **Token cost logging**: Log `usage.input_tokens` + `usage.output_tokens` from Anthropic response per request (NFR-001).
- **OpenAPI docs**: `@fastify/swagger` + `@fastify/swagger-ui` serve spec at `GET /documentation`; all routes must declare JSON Schema blocks.
- **CORS**: `@fastify/cors` wide-open (`origin: '*'`) for MVP.
- **GitHub Actions CI/CD**: `.github/workflows/ci.yml` — lint + `tsc --noEmit` on push/PR; Railway auto-deploys on push to `main`.
- **Project structure**: `src/index.ts`, `src/config.ts`, `src/errors.ts`, `src/types/index.ts`, `src/routes/extract.ts`, `src/services/ai-client.ts`, `src/services/formatter.ts`, `src/middleware/image-validator.ts`.

### UX Design Requirements

N/A — API-only service, no UI.

### FR Coverage Map

FR-001: Epic 2 — multipart/form-data accept, field `image`, in `src/routes/extract.ts`
FR-002: Epic 2 — MIME type validation in `src/middleware/image-validator.ts`
FR-003: Epic 2 — file size validation in `src/middleware/image-validator.ts`
FR-004: Epic 2 — error envelope via `src/errors.ts` + global handler in `src/index.ts`
FR-005: Epic 2 — image + prompt sent to Anthropic in `src/services/ai-client.ts`
FR-006: Epic 2 — prompt design enforces pure JSON in `src/services/ai-client.ts`
FR-007: Epic 2 — name/quantity/unit extraction in `src/services/ai-client.ts`
FR-008: Epic 2 — NoItemsFoundError thrown in `src/services/ai-client.ts`
FR-009: Epic 2 — name.length < 3 filter in `src/services/ai-client.ts`
FR-010: Epic 2 — retry loop (max 2) in `src/services/ai-client.ts`
FR-011: Epic 2 — success response contract in `src/routes/extract.ts` + `src/types/index.ts`
FR-012: Epic 2 — asterisk/checklist formatting in `src/services/formatter.ts`
FR-013: Epic 2 — items[] always present, enforced in `src/types/index.ts`
FR-014: Epic 2 — @fastify/rate-limit 10/min/IP in `src/index.ts`
FR-015: Epic 2 — pino per-request log in `src/index.ts` (onResponse hook)
FR-016: Epic 2 — AI failure log in `src/services/ai-client.ts`

## Epic List

### Epic 1: Project Foundation
As a developer, I have a fully configured, type-safe, and automatically deployable project foundation — so that every subsequent story can be implemented without revisiting infrastructure, and the service is production-ready from the first deploy.
**FRs covered:** None directly — enables all FRs
**NFRs addressed:** NFR-003 (timeout in config.ts), NFR-004 (config.ts boundary), NFR-007 (Railway deploy)

### Epic 2: Receipt Extraction API
A user can `POST /extract` with a supermarket receipt photo and receive a formatted, ready-to-paste shopping list — with full validation, AI extraction, response formatting, rate limiting, and production-grade logging.
**FRs covered:** FR-001 through FR-016 (all 16)
**NFRs addressed:** NFR-001 (token cost logging), NFR-002 (no pre-processing), NFR-003 (< 10s), NFR-004 (key redaction), NFR-005 (no persistence), NFR-006 (retry)

---

## Epic 1: Project Foundation

As a developer, I have a fully configured, type-safe, and automatically deployable project foundation — so that every subsequent story can be implemented without revisiting infrastructure, and the service is production-ready from the first deploy.

### Story 1.1: Project Initialization & Foundation Files

As a developer,
I want the project's package configuration, TypeScript build setup, and core TypeScript contracts (config, errors, types) initialized,
So that all subsequent implementation stories can import typed configuration and domain types from a stable, consistent foundation.

**Acceptance Criteria:**

**Given** a clean clone of the repository,
**When** I run `npm install`,
**Then** all dependencies install without errors.
**And** `package.json` contains `"engines": { "node": ">=24" }` and scripts: `dev` (`tsx --watch src/index.ts`), `build` (`tsc`), `start` (`node dist/index.js`).

**Given** the project is installed,
**When** I run `npm run build`,
**Then** TypeScript compiles to `dist/` with zero errors under `strict: true`.

**Given** a `.env` file with `ANTHROPIC_API_KEY=test`,
**When** I import `src/config.ts`,
**Then** `config.anthropicApiKey`, `config.port`, `config.maxFileSizeMb`, and `config.nodeEnv` are all accessible as typed values.
**And** `config.port` defaults to `3000` if `PORT` is unset.
**And** `config.maxFileSizeMb` defaults to `10` if `MAX_FILE_SIZE_MB` is unset.

**Given** the errors module (`src/errors.ts`),
**When** I construct typed errors,
**Then** `new InvalidFileTypeError('msg')` has `statusCode: 400`, `code: 'INVALID_FILE_TYPE'`.
**And** `new FileTooLargeError('msg')` has `statusCode: 400`, `code: 'FILE_TOO_LARGE'`.
**And** `new MissingFileError('msg')` has `statusCode: 400`, `code: 'MISSING_FILE'`.
**And** `new NoItemsFoundError('msg')` has `statusCode: 422`, `code: 'NO_ITEMS_FOUND'`.
**And** `new InternalError('msg')` has `statusCode: 500`, `code: 'INTERNAL_ERROR'`.

**Given** the types module (`src/types/index.ts`),
**When** I reference the exported interfaces,
**Then** `ExtractResponse` has `success: true`, `text: string`, `items: Item[]`, `total_items: number`.
**And** `Item` has `name: string`, `quantity: number`, `unit: string`.
**And** `ErrorResponse` has `success: false`, `error: ErrorCode`, `message: string`.
**And** `ErrorCode` is a union of all five error code literals.

**Given** the repository root,
**When** I inspect the files,
**Then** `.env.example` lists all four env vars: `ANTHROPIC_API_KEY`, `PORT`, `MAX_FILE_SIZE_MB`, `NODE_ENV`.
**And** `.nvmrc` contains `24`.
**And** `.gitignore` excludes `dist/`, `node_modules/`, `.env`.

---

### Story 1.2: Fastify Server with Plugin Suite

As a developer,
I want a running Fastify server with all required plugins registered (CORS, rate-limit, multipart, Swagger) and a global error handler,
So that I can implement route handlers in subsequent stories without modifying server infrastructure again.

**Acceptance Criteria:**

**Given** a `.env` with `ANTHROPIC_API_KEY=test`,
**When** I run `npm run dev`,
**Then** the server starts on port 3000 (default) with a pino startup log and no errors.

**Given** the server is running,
**When** I send `GET /documentation`,
**Then** I receive the Swagger UI HTML page (HTTP 200).

**Given** the server is running,
**When** I send `GET /documentation/json`,
**Then** I receive a valid OpenAPI 3.0 JSON specification.

**Given** a route handler throws a typed error (e.g. `new FileTooLargeError('...')`),
**When** the global `setErrorHandler` processes it,
**Then** the response has the correct HTTP status code and body `{ success: false, error: 'FILE_TOO_LARGE', message: string }`.

**Given** `src/index.ts`,
**When** I review the plugin registration order,
**Then** plugins are registered in this sequence: cors → rate-limit → multipart → swagger → swagger-ui → (routes) → error handler.
**And** `@fastify/rate-limit` is registered with `{ max: 10, timeWindow: '1 minute' }` and a custom `keyGenerator` that uses the client IP (FR-014).
**And** the rate-limit error response follows the PRD envelope: `{ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Limite de requisições excedido. Tente novamente em 1 minuto.' }` (FR-014).
**And** pino outputs pretty-printed logs in development (`NODE_ENV !== 'production'`) and JSON in production.
**And** the pino serializer redacts `ANTHROPIC_API_KEY` from any logged objects (NFR-004).

---

### Story 1.3: CI/CD Pipeline & Railway Deployment

As a developer,
I want an automated CI pipeline that validates every push and pull request, and a verified Railway deployment,
So that broken TypeScript never reaches production and deployments are fully automated.

**Acceptance Criteria:**

**Given** a push to any branch or an open pull request,
**When** the GitHub Actions workflow triggers,
**Then** it runs `npm ci` and `npm run build` on Node.js 24.x.
**And** the workflow fails and blocks the PR if TypeScript compilation fails.

**Given** a successful push to `main`,
**When** Railway's GitHub integration detects the push,
**Then** Railway builds and starts the service via `npm start`.
**And** `PORT` is supplied by Railway as an environment variable.
**And** `ANTHROPIC_API_KEY` is configured as a Railway secret variable (not in any committed file).

**Given** the deployed Railway service,
**When** I send `GET /documentation` to the Railway public URL,
**Then** I receive the Swagger UI page (HTTP 200), confirming the server is live.

---

## Epic 2: Receipt Extraction API

A user can `POST /extract` with a supermarket receipt photo and receive a formatted, ready-to-paste shopping list — with full validation, AI extraction, response formatting, rate limiting, and production-grade logging.

### Story 2.1: Image Upload & Validation

As a developer integrating with the ListAI API,
I want the `POST /extract` endpoint to validate uploaded images before processing,
So that clients receive immediate, descriptive error messages when the file format or size is invalid.

**Acceptance Criteria:**

**Given** a `POST /extract` request with a valid JPEG image under 10 MB,
**When** the request is processed,
**Then** the server accepts the file and returns the image buffer and MIME type as output of the middleware function with no validation error.
**And** the route appears in the OpenAPI spec at `GET /documentation/json` with `consumes: multipart/form-data`.

**Given** a `POST /extract` request with no `image` field,
**When** the request is processed,
**Then** the server returns HTTP 400 with `{ success: false, error: 'MISSING_FILE', message: 'Nenhum arquivo enviado.' }`.

**Given** a `POST /extract` request with a PDF file,
**When** the request is processed,
**Then** the server returns HTTP 400 with `{ success: false, error: 'INVALID_FILE_TYPE', message: 'Formato inválido. Use JPEG, PNG ou WEBP.' }` (FR-002).

**Given** a `POST /extract` request with a file larger than 10 MB,
**When** the request is processed,
**Then** the server returns HTTP 400 with `{ success: false, error: 'FILE_TOO_LARGE', message: 'Arquivo muito grande. O tamanho máximo é 10 MB.' }` (FR-003).

**Given** a `POST /extract` request with a valid PNG or WEBP file,
**When** the image validator processes it,
**Then** the file is read into memory only — no disk write occurs (NFR-005).
**And** PNG and WEBP are accepted alongside JPEG (FR-002).

**Given** the project's `package.json` dependencies,
**When** reviewing all installed packages,
**Then** no image processing library (e.g. sharp, jimp, canvas) is present — images are forwarded to the AI API as-is without any resize or pre-processing (NFR-002).

---

### Story 2.2: AI Extraction Service

As a user,
I want the service to extract a structured list of products from my receipt image using AI,
So that I get accurate name, quantity, and unit for each item without manual transcription.

**Acceptance Criteria:**

**Given** a valid image buffer and MIME type,
**When** `aiClient.extract(buffer, mimeType)` is called,
**Then** the Anthropic Vision API receives the image and a structured prompt requesting a JSON array of `{ name, quantity, unit }` objects (FR-005, FR-006, FR-007).
**And** the prompt contains explicit instructions to return only valid JSON — no markdown, no explanatory text (FR-006).
**And** the Anthropic SDK timeout is set to 8000ms (NFR-003).
**And** `config.anthropicApiKey` is used — no hard-coded key (NFR-004).

**Given** the AI returns a JSON array of items,
**When** the response is parsed,
**Then** any item whose `name` has fewer than 3 characters is discarded from the result (FR-009).
**And** the returned `Item[]` contains only entries with valid `name` (string ≥ 3 chars), numeric `quantity`, and string `unit`.

**Given** the parsed and filtered items array is empty,
**When** `aiClient.extract` processes the result,
**Then** it throws `NoItemsFoundError` (HTTP 422) (FR-008).

**Given** the Anthropic API returns a 5xx error or times out on the first attempt,
**When** the retry logic activates,
**Then** the call is retried up to 2 additional times before throwing `InternalError` (FR-010).
**And** `ai-client.ts` is the sole owner of retry logic — no retry exists in the route handler.

**Given** a successful API call,
**When** the response object is available,
**Then** `response.usage.input_tokens` and `response.usage.output_tokens` are accessible for downstream logging (NFR-001).

---

### Story 2.3: Response Formatting & Full Contract

As a user,
I want to receive my extracted shopping list as a ready-to-paste formatted text alongside the structured item data,
So that I can immediately copy it into Google Keep, WhatsApp, or Notion without any manual formatting.

**Acceptance Criteria:**

**Given** an `Item[]` array and `format=asterisk` (or no `format` param),
**When** `formatter.format(items, 'asterisk')` is called,
**Then** the returned `text` uses `* {name}   {quantity}{unit}` per item, joined by `\n` (FR-011, FR-012).

**Given** an `Item[]` array and `format=checklist`,
**When** `formatter.format(items, 'checklist')` is called,
**Then** the returned `text` uses `[ ] {name}   {quantity}{unit}` per item, joined by `\n` (FR-012).

**Given** a complete `POST /extract` request with a valid receipt image,
**When** validation and AI extraction succeed,
**Then** the response is HTTP 200 with body `{ success: true, text: string, items: Item[], total_items: number }` (FR-011).
**And** `total_items` equals `items.length` (FR-011).
**And** `items` is always present regardless of the `format` parameter chosen (FR-013).
**And** the field is named `total_items` (snake_case) — not `totalItems` (FR-011).
**And** `Content-Type` is `application/json`.

**Given** `format=asterisk` and `format=checklist` are both tested,
**When** comparing responses,
**Then** `items` and `total_items` are identical in both — only `text` differs (FR-013).

---

### Story 2.4: Rate Limiting & Production Observability

As an API operator,
I want the service to enforce per-IP rate limits and emit structured logs for every request and AI failure,
So that the service is protected from abuse and I have full operational visibility including token cost per request.

**Acceptance Criteria:**

**Given** an IP that sends 10 requests within one minute,
**When** the 11th request arrives within that same minute,
**Then** the server returns HTTP 429 with `{ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Limite de requisições excedido. Tente novamente em 1 minuto.' }` (FR-014).
**And** all further requests from that IP within the window also receive HTTP 429.

**Given** any `POST /extract` request that completes (success or error),
**When** the response is sent,
**Then** pino emits a JSON log record containing: timestamp, client IP, file size in bytes, total processing time in ms, total items extracted (or 0 on error), and HTTP status code (FR-015).

**Given** a successful AI extraction,
**When** the response log is emitted,
**Then** the log record includes `inputTokens` and `outputTokens` from `response.usage` (NFR-001).

**Given** an AI API call fails and triggers a retry,
**When** each attempt is logged,
**Then** the log record includes the error code, attempt number (1 or 2), and latency of that attempt in ms (FR-016).

**Given** pino serializer configuration in `src/index.ts`,
**When** any request or error is logged,
**Then** `ANTHROPIC_API_KEY` does not appear in any log output (NFR-004).
