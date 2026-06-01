import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { Item } from '../types';
import { InternalError, NoItemsFoundError } from '../errors';

const client = new Anthropic({
  apiKey: config.anthropicApiKey,
  timeout: 8000,
});

const PROMPT = `Analise esta imagem de recibo de supermercado e extraia todos os produtos comprados.

Retorne EXCLUSIVAMENTE um array JSON válido neste formato, sem markdown, sem texto adicional:
[{"name":"nome do produto","quantity":1,"unit":"un"}]

Regras:
- name: nome limpo em português (sem código, sem preço)
- quantity: número (use ponto para decimal, ex: 1.5)
- unit: unidade de medida (un, kg, g, L, ml, cx, pct, dz)
- Se não encontrar itens, retorne: []`;

export interface ExtractionResult {
  items: Item[];
  inputTokens: number;
  outputTokens: number;
}

export async function extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= 3; attempt++) {
    const start = Date.now();
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
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

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';

      let raw: Array<{ name: string; quantity: number; unit: string }>;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON from AI: ${text.slice(0, 100)}`);
      }

      const items: Item[] = raw.filter(
        (i) => typeof i.name === 'string' && i.name.length >= 3,
      );

      if (items.length === 0) {
        throw new NoItemsFoundError('Nenhum item identificado no recibo.');
      }

      return {
        items,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      if (err instanceof NoItemsFoundError) throw err;
      const latencyMs = Date.now() - start;
      lastError = err as Error;
      console.warn(JSON.stringify({
        event: 'ai_extraction_failed',
        attempt,
        latencyMs,
        error: lastError.message,
      }));
    }
  }

  throw new InternalError(`Falha ao processar imagem. Tente novamente. (${lastError.message})`);
}
