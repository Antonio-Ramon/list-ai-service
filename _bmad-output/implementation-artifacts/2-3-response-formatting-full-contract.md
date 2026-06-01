---
baseline_commit: 97f7362bcad7cd0bb53e9b2783c8b266e842d001
---

# Story 2.3: Response Formatting & Full Contract

Status: review

## Story

As a user,
I want to receive my extracted shopping list as a ready-to-paste formatted text alongside the structured item data,
So that I can immediately copy it into Google Keep, WhatsApp, or Notion without any manual formatting.

## Acceptance Criteria

1. `formatter.format(items, 'asterisk')` returns `text` where each item is `* {name}   {quantity}{unit}`, joined by `\n` (FR-011, FR-012).
2. `formatter.format(items, 'checklist')` returns `text` where each item is `[ ] {name}   {quantity}{unit}`, joined by `\n` (FR-012).
3. A complete `POST /extract` with a valid receipt returns HTTP 200 `{ success: true, text: string, items: Item[], total_items: number }` (FR-011). `total_items` equals `items.length`. `Content-Type` is `application/json`.
4. `items` array is always present in the response regardless of the `format` query parameter (FR-013). The field is named `total_items` in snake_case — never `totalItems`.
5. Both `format=asterisk` and `format=checklist` produce identical `items` and `total_items`; only `text` differs (FR-013).

## Tasks / Subtasks

- [x] Create `src/services/formatter.ts` (AC: 1–2)
  - [x] Export `FormatType` as `'asterisk' | 'checklist'`
  - [x] Export `format(items: Item[], formatType: FormatType): string`
  - [x] For `asterisk`: each line is `* ${item.name}   ${item.quantity}${item.unit}`
  - [x] For `checklist`: each line is `[ ] ${item.name}   ${item.quantity}${item.unit}`
  - [x] Join lines with `\n`
  - [x] Handle empty array: return `''`

- [x] Update `src/routes/extract.ts` — complete the response contract (AC: 3–5)
  - [x] Import `format, FormatType` from `../services/formatter`
  - [x] Read `format` query param: `const formatParam = (request.query as { format?: string }).format ?? 'asterisk'`
  - [x] Validate format param: if not `'asterisk'` or `'checklist'`, default to `'asterisk'`
  - [x] Call `const text = format(items, formatParam as FormatType)`
  - [x] Return `{ success: true as const, text, items, total_items: items.length }`
  - [x] Ensure `total_items` is snake_case — NEVER `totalItems`

- [x] Verify (AC: 1–5)
  - [x] `npm run build` → zero errors
  - [x] Test `POST /extract?format=asterisk` with real receipt → confirm `text` has `*` prefix lines
  - [x] Test `POST /extract?format=checklist` → confirm `text` has `[ ]` prefix lines
  - [x] Confirm `items` and `total_items` are identical in both responses
  - [x] Confirm `GET /documentation/json` shows the `format` query param with `enum: ['asterisk', 'checklist']`

## Dev Notes

**Prerequisite:** Story 2.2 complete. `src/services/ai-client.ts` exists and route calls `extract(buffer, mimeType)`.

**`src/services/formatter.ts` — complete implementation:**

```ts
import { Item } from '../types';

export type FormatType = 'asterisk' | 'checklist';

export function format(items: Item[], formatType: FormatType = 'asterisk'): string {
  if (items.length === 0) return '';
  return items
    .map(item => {
      const prefix = formatType === 'checklist' ? '[ ]' : '*';
      return `${prefix} ${item.name}   ${item.quantity}${item.unit}`;
    })
    .join('\n');
}
```

Note the spacing: **3 spaces** between `{name}` and `{quantity}{unit}` — as specified in the epics.

**Complete `src/routes/extract.ts` after Stories 2.1–2.3:**

```ts
import { FastifyInstance } from 'fastify';
import { validateImage } from '../middleware/image-validator';
import { extract } from '../services/ai-client';
import { format, FormatType } from '../services/formatter';

const VALID_FORMATS: FormatType[] = ['asterisk', 'checklist'];

export default async function extractRoutes(fastify: FastifyInstance) {
  fastify.post('/extract', {
    schema: {
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          image: { type: 'string', format: 'binary' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['asterisk', 'checklist'], default: 'asterisk' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            text: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  unit: { type: 'string' },
                },
              },
            },
            total_items: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const file = await request.file();
    const { buffer, mimeType } = await validateImage(file);

    const rawFormat = (request.query as { format?: string }).format ?? 'asterisk';
    const formatType: FormatType = VALID_FORMATS.includes(rawFormat as FormatType)
      ? (rawFormat as FormatType)
      : 'asterisk';

    const { items, inputTokens, outputTokens } = await extract(buffer, mimeType);
    const text = format(items, formatType);

    // Store context for observability hook (Story 2.4)
    (request as any).extractContext = {
      fileSizeBytes: buffer.length,
      totalItems: items.length,
      inputTokens,
      outputTokens,
    };

    return {
      success: true as const,
      text,
      items,
      total_items: items.length,
    };
  });
}
```

**CRITICAL — snake_case rule:** The field MUST be `total_items`, not `totalItems`. This is the PRD contract (FR-011). The TypeScript `ExtractResponse` interface in `src/types/index.ts` already enforces this — verify your return object matches.

**Format param handling:** Fastify validates querystring against the schema. With `default: 'asterisk'` in the schema, Fastify automatically sets the default. However, explicit defaulting in code is safer and more readable.

**`success: true as const`** — necessary for TypeScript to narrow to the `ExtractResponse` type which has `success: true` (not `success: boolean`).

### References
- [architecture.md#API Response Format] — `total_items` snake_case, exact field names
- [epics.md#Story 2.3 Acceptance Criteria]
- [epics.md#FR-011, FR-012, FR-013]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Build: `npm run build` → 0 errors (TypeScript 6)
- Verificado: resposta HTTP usa `total_items` (snake_case) — `totalItems` só existe no `extractContext` interno (observabilidade)
- Schema Swagger inclui `format` querystring com `enum: ['asterisk', 'checklist']` e `default: 'asterisk'`

### Completion Notes List

- Criado `src/services/formatter.ts`: exporta `FormatType` e `format()`. Asterisk produz `* name   qtunit`, checklist produz `[ ] name   qtunit`, 3 espaços entre nome e quantidade conforme spec. Array vazio retorna `''`.
- Atualizado `src/routes/extract.ts`: integra `format()`, valida `formatType` via array `VALID_FORMATS` com fallback para `'asterisk'`, armazena `extractContext` com `fileSizeBytes` no request para Story 2.4, retorna `{ success: true as const, text, items, total_items }`.
- Removido o `required: ['image']` do schema body (Fastify/multipart valida o arquivo via `validateImage` — o `required` no schema JSON causaria conflito com multipart).

### File List

- `src/services/formatter.ts` (new)
- `src/routes/extract.ts` (modified)

## Change Log

- 2026-06-01: Story 2.3 implementada — criado formatter.ts com suporte asterisk/checklist; extract.ts completo com contrato total (`text`, `items`, `total_items`).
