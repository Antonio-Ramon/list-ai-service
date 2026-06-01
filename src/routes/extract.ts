import { FastifyInstance } from 'fastify';

export default async function extractRoutes(fastify: FastifyInstance) {
  fastify.post('/extract', async (_request, _reply) => {
    return {};
  });
}
