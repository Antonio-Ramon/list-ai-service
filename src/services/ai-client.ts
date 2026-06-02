import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { Item } from '../types';
import { InternalError, NoItemsFoundError } from '../errors';
import { normalizeItems } from './normalizer';

const MODEL = 'claude-haiku-4-5-20251001';

const client = new Anthropic({
  apiKey: config.anthropicApiKey,
  timeout: 8000,
});

const PROMPT = `Analise esta imagem de recibo de supermercado e extraia todos os produtos comprados.

Retorne EXCLUSIVAMENTE um array JSON válido neste formato, sem markdown, sem texto adicional:
[{"name":"nome do produto","quantity":1,"unit":"un"}]

Regras:
- name: nome completo e legível em português — expanda abreviações típicas de recibo de supermercado (ex: "Ouu" → "Ovos", "Feij" → "Feijão", "Arr" → "Arroz", "Leit" → "Leite", "Sab" → "Sabonete", "Det" → "Detergente"); preserve marca e especificações visíveis (tamanho, peso, cor); não invente dados que não estejam no recibo
- quantity: número (use ponto para decimal, ex: 1.5)
- unit: unidade de medida (un, kg, g, L, ml, cx, pct, dz)
- Se não encontrar itens, retorne: []`;

export interface ExtractionResult {
  items: Item[];
  inputTokens: number;
  outputTokens: number;
}

interface Logger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  debug(obj: Record<string, unknown>, msg: string): void;
}

// Modelos às vezes ignoram a instrução e envolvem o JSON em ```json ... ```.
function stripCodeFences(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : text;
}

export async function extract(buffer: Buffer, mimeType: string, log: Logger): Promise<ExtractionResult> {
  let lastError: Error = new Error('Unknown error');
  const base64 = buffer.toString('base64');

  for (let attempt = 1; attempt <= 3; attempt++) {
    const start = Date.now();

    log.debug({ tentativa: attempt, total: 3, modelo: MODEL }, '[ai-client] enviando requisição para a Anthropic');

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
                  data: base64,
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

      const ms = Date.now() - start;
      const firstBlock = response.content[0];
      const rawText = firstBlock?.type === 'text' ? firstBlock.text.trim() : '[]';
      const text = stripCodeFences(rawText);

      log.debug({ tentativa: attempt, ms, tamanhoResposta: rawText.length }, '[ai-client] resposta recebida, interpretando JSON');

      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON from AI: ${text.slice(0, 100)}`);
      }

      if (!Array.isArray(raw)) {
        throw new Error(`AI returned non-array JSON: ${text.slice(0, 100)}`);
      }

      const items: Item[] = raw.filter(
        (i) =>
          typeof i.name === 'string' &&
          i.name.length >= 3 &&
          typeof i.quantity === 'number' &&
          typeof i.unit === 'string',
      );

      if (items.length === 0) {
        throw new NoItemsFoundError('Nenhum item identificado no recibo.');
      }

      const normalizedItems = normalizeItems(items);

      log.info(
        {
          tentativa: attempt,
          ms,
          itensExtraidos: normalizedItems.length,
          tokensEntrada: response.usage.input_tokens,
          tokensSaida: response.usage.output_tokens,
        },
        '[ai-client] extração concluída com sucesso',
      );

      return {
        items: normalizedItems,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      if (err instanceof NoItemsFoundError) throw err;

      const status = (err as { status?: number }).status;
      if (typeof status === 'number' && status >= 400 && status < 500) throw err;

      const ms = Date.now() - start;
      lastError = err as Error;

      log.warn(
        { tentativa: attempt, total: 3, ms, erro: lastError.message },
        '[ai-client] tentativa falhou, aguardando próxima tentativa',
      );
    }
  }

  log.warn({ erro: lastError.message }, '[ai-client] todas as 3 tentativas falharam, encerrando com erro');
  throw new InternalError(`Falha ao processar imagem. Tente novamente. (${lastError.message})`);
}
