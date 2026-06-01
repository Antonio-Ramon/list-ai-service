import { FastifyInstance } from 'fastify';
import { validateImage } from '../middleware/image-validator';

export default async function extractRoutes(fastify: FastifyInstance) {
  fastify.post('/extract', {
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
  }, async (request, _reply) => {
    const file = await request.file();
    await validateImage(file);
    return { success: true, text: '', items: [], total_items: 0 };
  });
}
