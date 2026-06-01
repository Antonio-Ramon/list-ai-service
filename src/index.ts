import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import extractRoutes from './routes/extract';

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

const fastify = Fastify({
  logger: {
    level: 'info',
    ...(config.nodeEnv !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
    serializers: {
      req(req: { method: string; url: string; ip: string }) {
        return { method: req.method, url: req.url, ip: req.ip };
      },
    },
    redact: ['ANTHROPIC_API_KEY', 'req.headers.authorization'],
  },
});

fastify.decorateRequest('extractContext', null);

// cors → rate-limit → multipart → swagger → swagger-ui → routes → hook → error handler
fastify.register(cors, { origin: '*' });

fastify.register(rateLimit, {
  max: 10,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Limite de requisições excedido. Tente novamente em 1 minuto.',
  }),
});

fastify.register(multipart, {
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});

fastify.register(swagger, {
  openapi: {
    info: { title: 'ListAI API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
  },
});

fastify.register(swaggerUi, { routePrefix: '/documentation' });

fastify.register(extractRoutes);

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

fastify.setErrorHandler((error, _request, reply) => {
  const err = error as FastifyError;
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  reply.status(statusCode).send({
    success: false,
    error: code,
    message: err.message,
  });
});

fastify.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on port ${config.port}`);
});

export default fastify;
