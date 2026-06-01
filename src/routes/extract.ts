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
  }, async (request, _reply) => {
    const file = await request.file();
    const { buffer, mimeType } = await validateImage(file);

    const rawFormat = (request.query as { format?: string }).format ?? 'asterisk';
    const formatType: FormatType = VALID_FORMATS.includes(rawFormat as FormatType)
      ? (rawFormat as FormatType)
      : 'asterisk';

    const { items, inputTokens, outputTokens } = await extract(buffer, mimeType);
    const text = format(items, formatType);

    (request as typeof request & { extractContext: object }).extractContext = {
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
