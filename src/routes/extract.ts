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
    validatorCompiler: () => () => true,
  }, async (request, _reply) => {
    const requestStart = Date.now();

    request.log.info({ ip: request.ip }, '[extract] requisição recebida');

    const file = await request.file();
    const { buffer, mimeType } = await validateImage(file);

    const fileSizeKb = (buffer.length / 1024).toFixed(1);
    const rawFormat = (request.query as { format?: string }).format ?? 'asterisk';
    const formatType: FormatType = VALID_FORMATS.includes(rawFormat as FormatType)
      ? (rawFormat as FormatType)
      : 'asterisk';

    request.log.info(
      { tipoArquivo: mimeType, tamanho: `${fileSizeKb} KB`, formato: formatType },
      '[extract] imagem validada, iniciando extração',
    );

    request.extractContext = {
      fileSizeBytes: buffer.length,
      totalItems: 0,
      inputTokens: 0,
      outputTokens: 0,
    };

    request.log.info({ modelo: 'claude-haiku-4-5-20251001' }, '[extract] enviando imagem para a IA');

    const { items, inputTokens, outputTokens } = await extract(buffer, mimeType, request.log);
    const text = format(items, formatType);

    request.extractContext.totalItems = items.length;
    request.extractContext.inputTokens = inputTokens;
    request.extractContext.outputTokens = outputTokens;

    const totalMs = Date.now() - requestStart;
    request.log.info(
      { itens: items.length, tokensEntrada: inputTokens, tokensSaida: outputTokens, totalMs, formato: formatType },
      '[extract] extração finalizada com sucesso',
    );

    return {
      success: true as const,
      text,
      items,
      total_items: items.length,
    };
  });
}
