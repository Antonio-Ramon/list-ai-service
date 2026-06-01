---
baseline_commit: NO_VCS
---

# Story 1.1: Project Initialization & Foundation Files

Status: review

## Story

As a developer,
I want the project's package configuration, TypeScript build setup, and core TypeScript contracts (config, errors, types) initialized,
so that all subsequent implementation stories can import typed configuration and domain types from a stable, consistent foundation.

## Acceptance Criteria

1. `npm install` runs without errors; `package.json` has `"engines": { "node": ">=24" }` and scripts `dev`, `build`, `start`.
2. `npm run build` compiles to `dist/` with zero errors under `strict: true`.
3. `src/config.ts` exports typed config object with `anthropicApiKey`, `port` (default 3000), `maxFileSizeMb` (default 10), `nodeEnv`.
4. `src/errors.ts` exports 5 typed error constructors: `InvalidFileTypeError` (400/INVALID_FILE_TYPE), `FileTooLargeError` (400/FILE_TOO_LARGE), `MissingFileError` (400/MISSING_FILE), `NoItemsFoundError` (422/NO_ITEMS_FOUND), `InternalError` (500/INTERNAL_ERROR).
5. `src/types/index.ts` exports `ExtractResponse`, `Item`, `ErrorResponse`, `ErrorCode` with exact field names from PRD (including `total_items` snake_case, NOT `totalItems`).
6. Root files present: `.env.example` (4 vars), `.nvmrc` ("24"), `.gitignore` (excludes `dist/`, `node_modules/`, `.env`).

## Tasks / Subtasks

- [x] Initialize package.json (AC: 1)
  - [x] Run `npm init -y` then set name, version, description
  - [x] Add `"engines": { "node": ">=24" }`
  - [x] Add scripts: `"dev": "tsx --watch src/index.ts"`, `"build": "tsc"`, `"start": "node dist/index.js"`
  - [x] Install production deps: `npm install fastify@^5.8.5 @fastify/multipart@^10.0.0 @fastify/rate-limit@^10.3.0 @fastify/cors@^11.2.0 @fastify/swagger@^9.7.0 @fastify/swagger-ui@^5.2.5 @fastify/error@^4.0.0 @anthropic-ai/sdk@^0.100.1`
  - [x] Install dev deps: `npm install -D typescript tsx @types/node`

- [x] Create tsconfig.json (AC: 2)
  - [x] Set `"strict": true`, `"target": "ES2022"`, `"module": "CommonJS"`, `"moduleResolution": "node10"`, `"outDir": "dist"`, `"rootDir": "src"`, `"esModuleInterop": true`

- [x] Create root config files (AC: 6)
  - [x] `.nvmrc` → single line: `24`
  - [x] `.env.example` → list `ANTHROPIC_API_KEY=`, `PORT=3000`, `MAX_FILE_SIZE_MB=10`, `NODE_ENV=development`
  - [x] `.gitignore` → entries: `dist/`, `node_modules/`, `.env`

- [x] Create `src/config.ts` (AC: 3)
  - [x] Export `config` object reading from `process.env` with defaults
  - [x] ONLY this file may read `process.env` — critical architectural rule
  - [x] Validate `ANTHROPIC_API_KEY` is present (throw on missing)

- [x] Create `src/errors.ts` (AC: 4)
  - [x] Import `createError` from `@fastify/error`
  - [x] Export all 5 typed error constructors with exact codes and status codes

- [x] Create `src/types/index.ts` (AC: 5)
  - [x] Export `Item` interface: `{ name: string; quantity: number; unit: string }`
  - [x] Export `ExtractResponse`: `{ success: true; text: string; items: Item[]; total_items: number }` — `total_items` MUST be snake_case
  - [x] Export `ErrorCode` union type with all 5 literal codes
  - [x] Export `ErrorResponse`: `{ success: false; error: ErrorCode; message: string }`

- [x] Verify build (AC: 2)
  - [x] Create placeholder `src/index.ts` (empty Fastify instance) so `tsc` has an entry point
  - [x] Run `npm run build` → zero errors

## Dev Notes

**Critical Architectural Rules (from architecture.md):**
- `src/config.ts` is the ONLY file allowed to read `process.env`. All others import from config. Violation breaks NFR-004 (API key leak prevention).
- Error codes MUST be SCREAMING_SNAKE_CASE strings exactly as defined. They appear in API responses.
- `total_items` field MUST be snake_case — NOT `totalItems`. This is the PRD contract (FR-011).
- All TypeScript must compile under `strict: true`. No `// @ts-ignore` or `any` without comments.

**`src/errors.ts` pattern — exact implementation:**
```ts
import createError from '@fastify/error';

export const InvalidFileTypeError = createError('INVALID_FILE_TYPE', '%s', 400);
export const FileTooLargeError    = createError('FILE_TOO_LARGE', '%s', 400);
export const MissingFileError     = createError('MISSING_FILE', '%s', 400);
export const NoItemsFoundError    = createError('NO_ITEMS_FOUND', '%s', 422);
export const InternalError        = createError('INTERNAL_ERROR', '%s', 500);
```

**`src/config.ts` pattern:**
```ts
export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  port: Number(process.env.PORT ?? 3000),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
```
Add a startup guard: `if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is required')`.

**tsconfig.json — use `"module": "Node16"` and `"moduleResolution": "Node16"`** to ensure `.js` extensions work correctly in ESM imports with TypeScript. Alternatively use `"module": "CommonJS"` + `"moduleResolution": "Node"` for simpler CJS setup — either is valid for this project. Pick CJS for simpler `require`-compatible setup with Railway.

**Package versions confirmed for 2026 (from architecture.md):**
- fastify@^5.8.5 (Fastify 5.x stable)
- @fastify/error@^4.0.0 (provides `createError` factory)
- @anthropic-ai/sdk@^0.100.1
- Node.js 24 LTS

**No test framework yet** — deferred per architecture decision. Vitest recommended when added.

### Project Structure Notes

This story creates the skeleton. Files created:
```
list-ai-service/
├── .env.example
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
├── tsconfig.json
└── src/
    ├── index.ts       (placeholder — just enough for tsc to succeed)
    ├── config.ts
    ├── errors.ts
    └── types/
        └── index.ts
```

Story 1.2 will fill in `src/index.ts` fully. Keep the placeholder minimal.

### References

- [Source: architecture.md#Structure Patterns] — `config.ts` boundary rule
- [Source: architecture.md#Process Patterns] — `errors.ts` typed factory pattern
- [Source: architecture.md#API Response Format] — `total_items` snake_case requirement
- [Source: architecture.md#Complete Project Directory Structure]
- [Source: architecture.md#Implementation Handoff] — exact install commands
- [Source: epics.md#Story 1.1 Acceptance Criteria]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- tsconfig.json: `"moduleResolution": "Node"` deprecado no TS 6.x — corrigido para `"node10"` + `"ignoreDeprecations": "6.0"`

### Completion Notes List

- Todos os 6 ACs satisfeitos e build zerado
- `package.json` configurado com engines node>=24, scripts dev/build/start e todas as deps
- `tsconfig.json` usa CommonJS + node10 com strict:true (CJS escolhido por compatibilidade com Railway)
- `src/config.ts` é a única fronteira que lê `process.env`; guarda de startup para ANTHROPIC_API_KEY presente
- `src/errors.ts` exporta 5 fábricas tipadas via `@fastify/error`
- `src/types/index.ts` exporta contratos com `total_items` em snake_case conforme PRD FR-011
- `src/index.ts` é placeholder mínimo; será expandido na Story 1.2
- `npm run build` compila para `dist/` sem erros

### File List

- package.json
- package-lock.json
- tsconfig.json
- .nvmrc
- .env.example
- .gitignore
- src/index.ts
- src/config.ts
- src/errors.ts
- src/types/index.ts

## Change Log

- 2026-06-01: Story implementada — package.json, tsconfig.json, arquivos raiz e módulos src/ criados; build zero erros
