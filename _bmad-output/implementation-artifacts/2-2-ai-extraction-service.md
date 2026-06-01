# Story 2.2: AI Extraction Service

Status: ready-for-dev

## Story

As a user,
I want the service to extract a structured list of products from my receipt image using AI,
So that I get accurate name, quantity, and unit for each item without manual transcription.

## Acceptance Criteria

1. When `aiClient.extract(buffer, mimeType)` is called with a valid image, the Anthropic Vision API receives the image and a structured prompt requesting a JSON array of `{ name, quantity, unit }` objects; the prompt explicitly instructs the model to return only valid JSON with no markdown (FR-005, FR-006, FR-007). SDK timeout is 8000ms (NFR-003). `config.anthropicApiKey` is used — no hard-coded key (NFR-004).
2. Any item whose `name` has fewer than 3 characters is discarded from the result (FR-009). The returned `Item[]` contains only entries with valid `name` (≥ 3 chars), numeric `quantity`, and string `unit`.
3. When the filtered items array is empty, `aiClient.extract` throws `NoItemsFoundError` with HTTP 422 (FR-008).
4. When the Anthropic API returns a 5xx error or times out on the first or second attempt, the call is retried up to 2 additional times (3 total) before throwing `InternalError`. `ai-client.ts` is the sole owner of retry logic — no retry anywhere in `extract.ts` (FR-010).
5. On a successful API call, `response.usage.input_tokens` and `response.usage.output_tokens` are returned alongside `items` so the route can log token cost (NFR-001).

## Tasks / Subtasks

- [ ] Create `src/services/ai-client.ts` (AC: 1–5)
  - [ ] Import `Anthropic` from `@anthropic-ai/sdk` and `config` from `../config`
  - [ ] Instantiate client once at module level: `new Anthropic({ apiKey: config.anthropicApiKey, timeout: 8000 })`
  - [ ] Export `ExtractionResult` interface: `{ items: Item[]; inputTokens: number; outputTokens: number }`
  - [ ] Export async `extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult>`
  - [ ] Convert buffer to base64 string inside the function
  - [ ] Define the extraction prompt (pure JSON instruction, Portuguese product names)
  - [ ] Implement retry loop: `for (let attempt = 1; attempt <= 3; attempt++)` with try/catch
  - [ ] On each attempt: call `client.messages.create(...)` with vision content
  - [ ] Parse the text response as JSON, filter items where `name.length < 3`
  - [ ] If filtered array is empty, throw `NoItemsFoundError('Nenhum item identificado no recibo.')`
  - [ ] On 5xx/timeout error: log attempt + error, continue loop; after 3 failures throw `InternalError`
  - [ ] On success: return `{ items, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }`

- [ ] Update `src/routes/extract.ts` — wire ai-client (AC: 1–5)
  - [ ] Import `extract` from `../services/ai-client`
  - [ ] After `validateImage`, call `const { items, inputTokens, outputTokens } = await extract(buffer, mimeType)`
  - [ ] Store extraction context on `request` for observability (Story 2.4 will use it): attach an object to the request
  - [ ] Return placeholder formatted response: `{ success: true, text: '', items, total_items: items.length }` (full text in Story 2.3)

- [ ] Verify (AC: 1–5)
  - [ ] `npm run build` → zero errors
  - [ ] Manual test with a real receipt JPEG → confirm items returned
  - [ ] Confirm no retry logic exists in `src/routes/extract.ts`

## Dev Notes

**Prerequisite:** Story 2.1 complete. `src/middleware/image-validator.ts` exists and `extract.ts` calls `validateImage`.

**Anthropic SDK `@anthropic-ai/sdk@^0.100.1` — vision pattern:**

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: config.anthropicApiKey,
  timeout: 8000,
});

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',  // cost-efficient for structured extraction (NFR-001)
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
            data: buffer.toString('base64'),
          },
        },
        {
          type: 'text',
          text: PROMPT,
        },
      ],
    },
  ],
});
```

**Model choice:** Use `claude-haiku-4-5-20251001` for cost efficiency (NFR-001: < US$0.02/request). Haiku handles structured JSON extraction from receipts well. If accuracy issues arise, escalate to `claude-sonnet-4-6`.

**Extraction prompt — must return pure JSON, no markdown:**

```ts
const PROMPT = `Analise esta imagem de recibo de supermercado e extraia todos os produtos comprados.

Retorne EXCLUSIVAMENTE um array JSON válido neste formato, sem markdown, sem texto adicional:
[{"name":"nome do produto","quantity":1,"unit":"un"}]

Regras:
- name: nome limpo em português (sem código, sem preço)
- quantity: número (use ponto para decimal, ex: 1.5)
- unit: unidade de medida (un, kg, g, L, ml, cx, pct, dz)
- Se não encontrar itens, retorne: []`;
```

**Retry loop — exact pattern:**

```ts
export async function extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({ ... });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
      const raw = JSON.parse(text) as Array<{ name: string; quantity: number; unit: string }>;
      const items: Item[] = raw.filter(i => typeof i.name === 'string' && i.name.length >= 3);

      if (items.length === 0) {
        throw new NoItemsFoundError('Nenhum item identificado no recibo.');
      }

      return {
        items,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      if (err instanceof NoItemsFoundError) throw err; // do not retry business errors
      lastError = err as Error;
      fastify.log.warn({ attempt, error: (err as Error).message }, 'AI extraction attempt failed');
      // continue to next attempt
    }
  }

  throw new InternalError(`Falha ao processar imagem. Tente novamente. (${lastError.message})`);
}
```

**Logging inside ai-client.ts:** The client module does not have access to the Fastify logger directly. Use `console.warn` for attempt failures here, and log full error details from the route handler via the passed-down logger, OR accept a `log` parameter. The simpler approach for MVP is to use the Node.js `console` methods inside ai-client — the pino transport will capture stdout. Alternatively, import fastify instance — but that creates a circular dependency. **Recommended:** Accept an optional `logger` parameter or use a module-level `import { fastify } from '../index'` — actually that creates circular import. **Use `console.warn` directly** in ai-client.ts for retry logs; pino captures all stdout in production.

**JSON parse safety:** The AI may occasionally return malformed JSON. Wrap `JSON.parse` in a try/catch inside the retry loop — a parse failure counts as an attempt failure and triggers retry.

```ts
let raw: Array<...>;
try {
  raw = JSON.parse(text);
} catch {
  throw new Error(`Invalid JSON from AI: ${text.slice(0, 100)}`);
}
```

**ExtractionResult interface:**
```ts
export interface ExtractionResult {
  items: Item[];
  inputTokens: number;
  outputTokens: number;
}
```

**Import from types:** `import { Item } from '../types';`

**CommonJS imports — no `.js` extensions.**

### References
- [architecture.md#Process Patterns] — retry owned by ai-client.ts exclusively
- [architecture.md#Structure Patterns] — config.ts boundary for API key
- [epics.md#Story 2.2 Acceptance Criteria]
- [epics.md#FR-005 through FR-010, NFR-001, NFR-003, NFR-004, NFR-006]

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
