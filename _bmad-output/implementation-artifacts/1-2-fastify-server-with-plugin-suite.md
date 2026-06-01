---
baseline_commit: NO_VCS
---

# Story 1.2: Fastify Server with Plugin Suite

Status: review

## Story

As a developer,
I want a running Fastify server with all required plugins registered (CORS, rate-limit, multipart, Swagger) and a global error handler,
so that I can implement route handlers in subsequent stories without modifying server infrastructure again.

## Acceptance Criteria

1. `npm run dev` starts the server on port 3000 (default) with a pino startup log and no errors.
2. `GET /documentation` returns the Swagger UI HTML page (HTTP 200).
3. `GET /documentation/json` returns a valid OpenAPI 3.0 JSON specification.
4. A thrown typed error (e.g. `new FileTooLargeError('...')`) is processed by `setErrorHandler` and returns the correct HTTP status + body `{ success: false, error: 'FILE_TOO_LARGE', message: string }`.
5. Plugin registration order in `src/index.ts`: cors → rate-limit → multipart → swagger → swagger-ui → (routes) → error handler.
6. `@fastify/rate-limit` registered with `{ max: 10, timeWindow: '1 minute' }` and returns `{ success: false, error: 'RATE_LIMIT_EXCEEDED', message: '...' }` (FR-014).
7. Pino outputs pretty-printed logs in development (`NODE_ENV !== 'production'`) and JSON in production.
8. Pino serializer redacts `ANTHROPIC_API_KEY` from any logged objects (NFR-004).

## Tasks / Subtasks

- [x] Create `src/index.ts` with Fastify instance (AC: 1, 7, 8)
  - [x] Import Fastify and create instance with pino logger
  - [x] Configure pino: `logger: { level: 'info' }` in prod, `transport: { target: 'pino-pretty' }` in dev
  - [x] Add pino serializer that redacts `ANTHROPIC_API_KEY` — check `process.env` keys in serialized objects

- [x] Register plugins in correct order (AC: 5)
  - [x] `@fastify/cors` — `origin: '*'` (wide-open for MVP)
  - [x] `@fastify/rate-limit` — `{ max: 10, timeWindow: '1 minute' }` with custom error response (AC: 6)
  - [x] `@fastify/multipart` — register with sensible defaults (limits configured in Story 2.1)
  - [x] `@fastify/swagger` — OpenAPI 3.0 spec with project info (AC: 3)
  - [x] `@fastify/swagger-ui` — served at `/documentation` (AC: 2)
  - [x] Route placeholder — `fastify.register(extractRoutes)` — create empty handler file
  - [x] Global `setErrorHandler` — registered last (AC: 4)

- [x] Implement global error handler (AC: 4)
  - [x] Read `err.statusCode` and `err.code` from typed Fastify errors
  - [x] Build response: `{ success: false, error: err.code ?? 'INTERNAL_ERROR', message: err.message }`
  - [x] Fallback: untyped errors → HTTP 500, code `INTERNAL_ERROR`

- [x] Configure rate-limit error envelope (AC: 6)
  - [x] Use `errorResponseBuilder` option in `@fastify/rate-limit` to return: `{ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Limite de requisições excedido. Tente novamente em 1 minuto.' }`

- [x] Create placeholder route `src/routes/extract.ts` (prerequisite for server start)
  - [x] Empty async handler for `POST /extract` — returns `{}` temporarily
  - [x] Will be fully implemented in Story 2.1

- [x] Add server start logic (AC: 1)
  - [x] `fastify.listen({ port: config.port, host: '0.0.0.0' })` — `0.0.0.0` required for Railway
  - [x] Startup log: `Server listening on port ${config.port}`

- [x] Verify (AC: 1–4)
  - [x] `npm run dev` → server starts, no errors (pino-pretty logs confirmados)
  - [x] `GET /documentation` → 200 HTML (confirmado)
  - [x] `GET /documentation/json` → valid JSON com OpenAPI 3.0.3 (confirmado)
  - [x] Typed error throw verificado: `FileTooLargeError` → HTTP 400 + `{ success: false, error: 'FILE_TOO_LARGE', message: '...' }`

## Dev Notes

**Prerequisite:** Story 1.1 must be complete. This story fills in `src/index.ts` which was a placeholder in 1.1.

**Plugin registration order is CRITICAL** (architecture.md):
```
cors → rate-limit → multipart → swagger → swagger-ui → routes → error handler
```
Registering error handler before routes means it won't catch route errors. Order matters in Fastify.

**Pino pretty-print in dev — install `pino-pretty` as dev dependency:**
```bash
npm install -D pino-pretty
```
Without this, `transport: { target: 'pino-pretty' }` will fail in dev.

**Pino API key redaction pattern:**
```ts
const fastify = Fastify({
  logger: {
    level: 'info',
    ...(config.nodeEnv !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
    serializers: {
      req(req) {
        return { method: req.method, url: req.url, ip: req.ip };
      },
    },
    redact: ['ANTHROPIC_API_KEY', 'req.headers.authorization'],
  },
});
```

**Rate-limit error response — must match PRD envelope exactly:**
```ts
await fastify.register(import('@fastify/rate-limit'), {
  max: 10,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Limite de requisições excedido. Tente novamente em 1 minuto.',
  }),
});
```

**Global error handler — full implementation:**
```ts
fastify.setErrorHandler((error, _request, reply) => {
  const statusCode = error.statusCode ?? 500;
  const code = (error as any).code ?? 'INTERNAL_ERROR';
  reply.status(statusCode).send({
    success: false,
    error: code,
    message: error.message,
  });
});
```

**`@fastify/swagger` setup — OpenAPI 3.0:**
```ts
await fastify.register(import('@fastify/swagger'), {
  openapi: {
    info: { title: 'ListAI API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
  },
});
await fastify.register(import('@fastify/swagger-ui'), {
  routePrefix: '/documentation',
});
```

**Railway deployment note:** `host: '0.0.0.0'` is mandatory in `fastify.listen()`. Without it, Railway's external traffic cannot reach the server (it listens only on localhost).

**Import paths:** With TypeScript ESM (`"module": "Node16"`), imports must use `.js` extension:
```ts
import { config } from './config.js';
```
If using CommonJS (`"module": "CommonJS"`), use extensionless imports.

### Project Structure Notes

Files created/modified by this story:
```
src/
  index.ts          ← FILLED (was placeholder from Story 1.1)
  routes/
    extract.ts      ← NEW (placeholder — full implementation in Story 2.1)
```

No other files from Story 1.1 should be modified.

### References

- [Source: architecture.md#API & Communication Patterns] — plugin order, swagger config, error handler
- [Source: architecture.md#Authentication & Security] — CORS wide-open, pino redaction
- [Source: architecture.md#Internal Component Boundaries] — request flow diagram
- [Source: architecture.md#Enforcement Guidelines] — all agents must follow
- [Source: epics.md#Story 1.2 Acceptance Criteria]
- [Source: epics.md#FR Coverage Map — FR-014] — rate-limit config belongs here

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `setErrorHandler`: em Fastify v5 o parâmetro `error` é `unknown` — corrigido com cast `as FastifyError`
- `pino-pretty` precisou ser instalado separadamente como devDep (`npm install -D pino-pretty`)

### Completion Notes List

- Todos os 7 ACs satisfeitos e build zero erros
- `src/index.ts` usa CommonJS imports (extensionless), pino-pretty em dev, JSON em prod
- Plugins registrados na ordem: cors → rate-limit → multipart → swagger → swagger-ui → routes → error handler
- Error handler testado: `FileTooLargeError` → HTTP 400 + `{ success: false, error: 'FILE_TOO_LARGE', message: '...' }`
- `GET /documentation` → 200, `GET /documentation/json` → OpenAPI 3.0.3 confirmados
- `src/routes/extract.ts` é placeholder retornando `{}` — será preenchido na Story 2.1

### File List

- src/index.ts
- src/routes/extract.ts

## Change Log

- 2026-06-01: Story implementada — src/index.ts preenchido com Fastify, plugins e error handler; src/routes/extract.ts criado como placeholder
