import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { Item } from '../types';
import { PersistenceError, NotFoundError } from '../errors';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

interface Logger {
  info(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

export interface SaveExtractionInput {
  rawText: string;
  title: string;
  format: string;
  elapsedSeconds: number;
  fileSizeBytes: number;
  inputTokens: number;
  outputTokens: number;
  items: Item[];
}

// Persiste extração + itens atomicamente via RPC. Lança PersistenceError se falhar.
export async function saveExtraction(input: SaveExtractionInput, log: Logger): Promise<string> {
  const { data, error } = await supabase.rpc('save_extraction', {
    p_raw_text: input.rawText,
    p_title: input.title,
    p_format: input.format,
    p_elapsed_seconds: input.elapsedSeconds,
    p_file_size_bytes: input.fileSizeBytes,
    p_input_tokens: input.inputTokens,
    p_output_tokens: input.outputTokens,
    p_items: input.items,
  });

  if (error) {
    log.error({ erro: error.message, codigo: error.code, detalhe: error.details }, '[db] falha ao gravar extração');
    throw new PersistenceError(`Falha ao salvar no banco de dados. (${error.message})`);
  }

  const extractionId = data as string;
  log.info({ extractionId, itens: input.items.length }, '[db] extração gravada com sucesso');
  return extractionId;
}

export interface HistoryResult {
  rows: unknown[];
  total: number;
}

export interface HistoryFilters {
  limit: number;
  offset: number;
  format?: string;
  title?: string;
}

// Lista extrações (mais recentes primeiro) com itens embutidos + total geral (já filtrado).
export async function getHistory(filters: HistoryFilters, log: Logger): Promise<HistoryResult> {
  const { limit, offset, format, title } = filters;

  let query = supabase
    .from('extractions')
    .select('*, extraction_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('position', { ascending: true, referencedTable: 'extraction_items' });

  if (format) query = query.eq('format', format);
  if (title) query = query.ilike('title', `%${title}%`);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    log.error({ erro: error.message, codigo: error.code, detalhe: error.details }, '[db] falha ao buscar histórico');
    throw new PersistenceError(`Falha ao buscar histórico. (${error.message})`);
  }

  const total = count ?? 0;
  log.info({ retornados: data.length, total, limit, offset, format, title }, '[db] histórico consultado');
  return { rows: data, total };
}

// Deleta uma extração por id (itens caem via ON DELETE CASCADE). Lança NotFoundError se não existir.
export async function deleteExtraction(id: string, log: Logger): Promise<void> {
  const { data, error } = await supabase
    .from('extractions')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    log.error({ erro: error.message, codigo: error.code, detalhe: error.details }, '[db] falha ao deletar extração');
    throw new PersistenceError(`Falha ao deletar extração. (${error.message})`);
  }

  if (data.length === 0) {
    log.info({ id }, '[db] extração não encontrada para deletar');
    throw new NotFoundError('Extração não encontrada.');
  }

  log.info({ id }, '[db] extração deletada com sucesso');
}
