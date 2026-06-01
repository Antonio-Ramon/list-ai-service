# Story 2.4: Rate Limiting & Production Observability

Status: ready-for-dev

## Story

As an API operator,
I want the service to enforce per-IP rate limits and emit structured logs for every request and AI failure,
So that the service is protected from abuse and I have full operational visibility including token cost per request.

## Acceptance Criteria

1. An IP that sends 10 requests within one minute receives HTTP 429 `{ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Limite de requisições excedido. Tente novamente em 1 minuto.' }` on the 11th request (FR-014). All further requests from that IP in the same window also receive 429.
2. Every `POST /extract` that completes (success or error) emits a pino JSON log record containing: timestamp (automatic), client IP, file size in bytes, total processing time in ms, total items extracted (0 on error), and HTTP status code (FR-015).
3. A successful AI extraction emits a log record that includes `inputTokens` and `outputTokens` from `response.usage` (NFR-001).
4. `ANTHROPIC_API_KEY` does not appear in any log output — enforced by the pino `redact` config already in `src/index.ts` (NFR-004).

## Tasks / Subtasks

- [ ] Add `extractContext` request decorator to `src/index.ts` (AC: 2–3)
  - [ ] Add TypeScript module augmentation for `FastifyRequest` to include `extractContext`
  - [ ] Register decorator: `fastify.decorateRequest('extractContext', null)`
  - [ ] Place decorator registration before plugin registrations

- [ ] Add `onResponse` hook to `src/index.ts` (AC: 2–3)
  - [ ] Register `fastify.addHook('onResponse', ...)` after all plugin registrations but before `setErrorHandler`
  - [ ] Log: `request.log.info({ ip, statusCode, processingTimeMs, fileSizeBytes, totalItems, inputTokens, outputTokens })`
  - [ ] Read values from `request.extractContext` (set by route handler in Story 2.3)
  - [ ] Default `fileSizeBytes`, `totalItems`, `inputTokens`, `outputTokens` to `0` / `undefined` when context is null (error path)

- [ ] Verify rate limiting (AC: 1)
  - [ ] Confirm `@fastify/rate-limit` already registered in `src/index.ts` with `max: 10, timeWindow: '1 minute'`
  - [ ] Test: send 11 requests in quick succession → 11th returns 429 with correct envelope
  - [ ] No code changes needed for rate limiting if Story 1.2 is complete

- [ ] Verify AI failure logging in `src/services/ai-client.ts` (AC: 2, FR-016)
  - [ ] Confirm each retry attempt logs: error code/message, attempt number, and latency in ms
  - [ ] If not already implemented in Story 2.2, add timing: `const start = Date.now()` before attempt, `const latencyMs = Date.now() - start` after
  - [ ] Log via `console.warn({ attempt, latencyMs, error: err.message }, 'AI extraction attempt failed')`

- [ ] Verify (AC: 1–4)
  - [ ] `npm run build` → zero errors
  - [ ] Test `POST /extract` with valid image → check Railway/local logs for structured record
  - [ ] Confirm `inputTokens`, `outputTokens`, `fileSizeBytes`, `totalItems` appear in log
  - [ ] Send 11 requests → confirm 429 on 11th
  - [ ] Confirm no `ANTHROPIC_API_KEY` value in any log line

## Dev Notes

**Prerequisite:** Story 2.3 complete. Full pipeline working: validate → extract → format → respond.

**Rate limiting already configured in `src/index.ts` (Story 1.2):**

```ts
fastify.register(rateLimit, {
  max: 10,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Limite de requisições excedido. Tente novamente em 1 minuto.',
  }),
});
```

**No changes needed to rate-limit config** unless tests reveal issues. This story's focus is observability.

**TypeScript module augmentation for request decorator:**

```ts
// Place at the top of src/index.ts, before imports or after:
declare module 'fastify' {
  interface FastifyRequest {
    extractContext: {
      fileSizeBytes: number;
      totalItems: number;
      inputTokens: number;
      outputTokens: number;
    } | null;
  }
}
```

**Decorator registration — must come before routes:**

```ts
fastify.decorateRequest('extractContext', null);
```

**`onResponse` hook — full implementation:**

```ts
fastify.addHook('onResponse', (request, reply, done) => {
  const ctx = request.extractContext;
  request.log.info({
    ip: request.ip,
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    processingTimeMs: Math.round(reply.elapsedTime),
    fileSizeBytes: ctx?.fileSizeBytes ?? 0,
    totalItems: ctx?.totalItems ?? 0,
    inputTokens: ctx?.inputTokens ?? 0,
    outputTokens: ctx?.outputTokens ?? 0,
  }, 'request completed');
  done();
});
```

**Where to add the hook in `src/index.ts`** — after plugin registrations, before `setErrorHandler`:

```ts
fastify.register(extractRoutes);  // existing

fastify.addHook('onResponse', ...);  // NEW — add here

fastify.setErrorHandler(...);  // existing
```

**Route handler sets context (Story 2.3 implementation):**

```ts
// In src/routes/extract.ts (set after successful extraction)
request.extractContext = {
  fileSizeBytes: buffer.length,
  totalItems: items.length,
  inputTokens,
  outputTokens,
};
```

If the route throws before setting `extractContext` (e.g. validation error), the hook reads `null` and defaults all values to `0` — this is correct; we still log the failed request with `totalItems: 0`.

**AI failure logging in `src/services/ai-client.ts`** — per-attempt log with latency:

```ts
for (let attempt = 1; attempt <= 3; attempt++) {
  const start = Date.now();
  try {
    const response = await client.messages.create({ ... });
    // ... success path
  } catch (err) {
    if (err instanceof NoItemsFoundError) throw err;
    const latencyMs = Date.now() - start;
    console.warn(JSON.stringify({
      event: 'ai_extraction_failed',
      attempt,
      latencyMs,
      error: (err as Error).message,
    }));
    lastError = err as Error;
  }
}
```

**Key log fields required by FR-015/FR-016:**

| Field | Source | FR |
|---|---|---|
| `ip` | `request.ip` | FR-015 |
| `fileSizeBytes` | `buffer.length` set in route | FR-015 |
| `processingTimeMs` | `reply.elapsedTime` | FR-015 |
| `totalItems` | `items.length` set in route | FR-015 |
| `statusCode` | `reply.statusCode` | FR-015 |
| `inputTokens` | `response.usage.input_tokens` | NFR-001 |
| `outputTokens` | `response.usage.output_tokens` | NFR-001 |
| `attempt` (in ai-client) | loop counter | FR-016 |
| `latencyMs` (in ai-client) | `Date.now()` delta | FR-016 |

**NFR-004 verification:** The pino `redact` config in `src/index.ts` already includes `'ANTHROPIC_API_KEY'`. No additional action needed — just confirm no code explicitly logs the API key value.

### References
- [architecture.md#API & Communication Patterns] — rate-limit config
- [architecture.md#Authentication & Security] — NFR-004 key redaction
- [epics.md#Story 2.4 Acceptance Criteria]
- [epics.md#FR-014, FR-015, FR-016, NFR-001, NFR-004]

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
