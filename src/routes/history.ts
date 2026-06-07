import { FastifyInstance } from 'fastify';
import { getHistory, deleteExtraction } from '../services/db';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default async function historyRoutes(fastify: FastifyInstance) {
  fastify.get('/history', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
          offset: { type: 'integer', minimum: 0, default: 0 },
          format: { type: 'string', enum: ['asterisk', 'checklist', 'simple', 'excel'] },
          filter: { type: 'string', minLength: 1, description: 'Filtra por title (nome do arquivo), case-insensitive' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'integer' },
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  created_at: { type: 'string' },
                  title: { type: ['string', 'null'] },
                  raw_text: { type: 'string' },
                  total_items: { type: 'integer' },
                  format: { type: 'string' },
                  elapsed_seconds: { type: 'number' },
                  file_size_bytes: { type: 'integer' },
                  input_tokens: { type: 'integer' },
                  output_tokens: { type: 'integer' },
                  user_id: { type: ['string', 'null'] },
                  extraction_items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        position: { type: 'integer' },
                        name: { type: 'string' },
                        quantity: { type: 'number' },
                        unit: { type: 'string' },
                        price: { type: ['number', 'null'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, _reply) => {
    const { limit = DEFAULT_LIMIT, offset = 0, format, filter } = request.query as {
      limit?: number;
      offset?: number;
      format?: string;
      filter?: string;
    };

    request.log.info({ ip: request.ip, limit, offset, format, filter }, '[history] requisição recebida');

    const { rows, total } = await getHistory({ limit, offset, format, title: filter }, request.log);

    return {
      success: true as const,
      count: rows.length,
      total,
      limit,
      offset,
      history: rows,
    };
  });

  fastify.delete('/history/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            id: { type: 'string' },
          },
        },
      },
    },
  }, async (request, _reply) => {
    const { id } = request.params as { id: string };

    request.log.info({ ip: request.ip, id }, '[history] requisição de delete recebida');

    await deleteExtraction(id, request.log);

    return { success: true as const, id };
  });
}
