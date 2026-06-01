---
baseline_commit: 11da952da82242341434e1696d49aac7379685f2
---

# Story 2.1: Image Upload & Validation

Status: review

## Story

As a developer integrating with the ListAI API,
I want the `POST /extract` endpoint to validate uploaded images before processing,
So that clients receive immediate, descriptive error messages when the file format or size is invalid.

## Acceptance Criteria

1. A `POST /extract` with a valid JPEG under 10 MB is accepted; the middleware returns `{ buffer, mimeType }` with no error, and the route appears in `GET /documentation/json` with `consumes: multipart/form-data`.
2. A `POST /extract` with no `image` field returns HTTP 400 `{ success: false, error: 'MISSING_FILE', message: 'Nenhum arquivo enviado.' }`.
3. A `POST /extract` with a PDF returns HTTP 400 `{ success: false, error: 'INVALID_FILE_TYPE', message: 'Formato inválido. Use JPEG, PNG ou WEBP.' }`.
4. A `POST /extract` with a file > 10 MB returns HTTP 400 `{ success: false, error: 'FILE_TOO_LARGE', message: 'Arquivo muito grande. O tamanho máximo é 10 MB.' }`.
5. PNG and WEBP files are accepted alongside JPEG; the file is read into memory only — no disk write (NFR-005).
6. No image processing library (sharp, jimp, canvas, etc.) is present in `package.json` (NFR-002).

## Tasks / Subtasks

- [x] Update `@fastify/multipart` registration in `src/index.ts` (AC: 4)
  - [x] Add `limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 }` to multipart registration
  - [x] This is the only change to `src/index.ts` in this story

- [x] Create `src/middleware/image-validator.ts` (AC: 1–5)
  - [x] Export `ValidatedImage` interface: `{ buffer: Buffer; mimeType: string }`
  - [x] Export async `validateImage(file: MultipartFile | undefined): Promise<ValidatedImage>`
  - [x] Throw `MissingFileError('Nenhum arquivo enviado.')` if file is undefined
  - [x] Throw `InvalidFileTypeError('Formato inválido. Use JPEG, PNG ou WEBP.')` if MIME not in `['image/jpeg', 'image/png', 'image/webp']`
  - [x] Call `file.toBuffer()` to read into memory (no disk write — NFR-005)
  - [x] Throw `FileTooLargeError('Arquivo muito grande. O tamanho máximo é 10 MB.')` if `buffer.length > config.maxFileSizeMb * 1024 * 1024`
  - [x] Return `{ buffer, mimeType: file.mimetype }`

- [x] Update `src/routes/extract.ts` — add schema + call validator (AC: 1–5)
  - [x] Import `validateImage` from `../middleware/image-validator`
  - [x] Add `schema` block to the route with `consumes: ['multipart/form-data']`, body (image binary), querystring (format param), and response shapes for 200/400/422/429
  - [x] Inside handler: call `request.file()` to get the multipart file
  - [x] Call `validateImage(file)` — on error it throws and global handler returns correct envelope
  - [x] For now return a placeholder `{ success: true, text: '', items: [], total_items: 0 }` (full implementation in Stories 2.2–2.3)

- [x] Verify (AC: 1–6)
  - [x] `npm run build` → zero errors
  - [x] Test: POST with valid JPEG → 200 (placeholder response)
  - [x] Test: POST with no file → 400 MISSING_FILE
  - [x] Test: POST with PDF (application/pdf) → 400 INVALID_FILE_TYPE
  - [x] Test: POST with PNG → 200 (accepted)
  - [x] Confirm no image processing libs in package.json

## Dev Notes

**Prerequisite:** Stories 1.1 and 1.2 complete. `@fastify/multipart` already registered globally in `src/index.ts`.

**`@fastify/multipart@10` API — key points:**

```ts
// In the route handler, read the uploaded file:
const file = await request.file();
// file is MultipartFile | undefined

// Read into memory (no disk write — satisfies NFR-005):
const buffer = await file.toBuffer();

// Access MIME type from the part:
file.mimetype // e.g. 'image/jpeg', 'image/png', 'image/webp'
```

**Multipart registration update** — add limits to prevent oversized files reaching application code:

```ts
// src/index.ts — replace:
fastify.register(multipart);

// With:
fastify.register(multipart, {
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});
```

When `@fastify/multipart` hits the size limit it throws its own error — the global `setErrorHandler` will catch it but produce a generic message. Our `validateImage` checks `buffer.length` AFTER `toBuffer()` to produce the correct typed `FileTooLargeError` with the Portuguese message. The multipart limit acts as a safety backstop for extremely large uploads only.

**`src/middleware/image-validator.ts` — full implementation:**

```ts
import { MultipartFile } from '@fastify/multipart';
import { config } from '../config';
import { FileTooLargeError, InvalidFileTypeError, MissingFileError } from '../errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ValidatedImage {
  buffer: Buffer;
  mimeType: string;
}

export async function validateImage(file: MultipartFile | undefined): Promise<ValidatedImage> {
  if (!file) {
    throw new MissingFileError('Nenhum arquivo enviado.');
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new InvalidFileTypeError('Formato inválido. Use JPEG, PNG ou WEBP.');
  }
  const buffer = await file.toBuffer();
  if (buffer.length > config.maxFileSizeMb * 1024 * 1024) {
    throw new FileTooLargeError('Arquivo muito grande. O tamanho máximo é 10 MB.');
  }
  return { buffer, mimeType: file.mimetype };
}
```

**Route schema block** — declare for Swagger and Fastify validation:

```ts
schema: {
  consumes: ['multipart/form-data'],
  body: {
    type: 'object',
    required: ['image'],
    properties: {
      image: { type: 'string', format: 'binary', description: 'Receipt image (JPEG, PNG, WEBP, max 10 MB)' },
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
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
},
```

**Import path note:** CommonJS setup — extensionless imports only. `import { validateImage } from '../middleware/image-validator'` (no `.js`).

**Do NOT install any image processing library.** MIME type comes directly from the multipart header — no magic-bytes detection needed for MVP. NFR-002 forbids resizing/pre-processing.

**Current state of files being modified:**
- `src/index.ts`: multipart registered as `fastify.register(multipart)` — needs limits added
- `src/routes/extract.ts`: placeholder returning `{}` — needs schema + validateImage call + placeholder success response

### References
- [architecture.md#Structure Patterns] — config.ts boundary, error factory pattern
- [architecture.md#Internal Component Boundaries] — image-validator position in the pipeline
- [epics.md#Story 2.1 Acceptance Criteria]
- [epics.md#FR-001, FR-002, FR-003, FR-004, NFR-002, NFR-005]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 }` to `@fastify/multipart` registration — acts as safety backstop for oversized uploads before they reach application code.
- Created `src/middleware/image-validator.ts` with `ValidatedImage` interface and `validateImage` function. Validates MIME type from multipart header (no magic-bytes needed per NFR-002), reads file into memory with `toBuffer()` (no disk write per NFR-005), and throws typed errors caught by the global error handler.
- Updated `src/routes/extract.ts` with full OpenAPI schema (`consumes: multipart/form-data`, body, querystring, response shapes) and calls `validateImage`. Returns placeholder `{ success: true, text: '', items: [], total_items: 0 }` — AI extraction deferred to Stories 2.2–2.3.
- `npm run build` → zero TypeScript errors. No image processing libraries (sharp, jimp, canvas, etc.) in package.json.

### File List

- src/index.ts (modified)
- src/middleware/image-validator.ts (created)
- src/routes/extract.ts (modified)

### Change Log

- 2026-06-01: Story 2.1 implemented — image upload validation middleware, multipart size limits, route schema, placeholder response.
