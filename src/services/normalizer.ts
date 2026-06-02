import { Item } from '../types';

// Multi-word phrase patterns — checked first, in order
const PHRASE_PATTERNS: Array<[RegExp, string]> = [
  [/\bL\s+R\b/gi, 'Lava Roupa'],
  [/\bHost\s+Cot\b/gi, 'Hastes de Algodão'],
  [/\bHast\s+Cot\b/gi, 'Hastes de Algodão'],
  [/\bF\s+Hand\b/gi, 'Farinha de Trigo'],
  [/\bSal\s+Rs?\b/gi, 'Sal Rosa'],
  [/\bE\s+V\b/gi, 'Extra Virgem'],
  [/\bSemi\s+La\b/gi, 'Semiconcentrado Lavanda'],
  [/\bSemi\s+Con\b/gi, 'Semiconcentrado'],
  [/\bL(\d+)P(\d+)\b/g, 'Leve $1 Pague $2'],
];

// Single-token abbreviations — matched against whole words, case-insensitive
const TOKEN_MAP: Record<string, string> = {
  // --- Limpeza ---
  'det': 'Detergente',
  'detg': 'Detergente',
  'desin': 'Desinfetante',
  'am': 'Amaciante',
  'amas': 'Amaciante',
  'sani': 'Sanitizante',
  'sanit': 'Sanitizante',
  'alv': 'Alvejante',
  'esp': 'Esponja',
  'esponj': 'Esponja',
  'limpa': 'Limpador',
  'limp': 'Limpador',

  // --- Higiene Pessoal ---
  'esc': 'Escova',
  'escov': 'Escova',
  'shamp': 'Shampoo',
  'sham': 'Shampoo',
  'cond': 'Condicionador',
  'desod': 'Desodorante',
  'absorv': 'Absorvente',
  'hast': 'Hastes',
  'host': 'Hastes',
  'cot': 'Algodão',
  'past': 'Pasta',
  'crem': 'Creme',

  // --- Alimentos — categorias ---
  'feij': 'Feijão',
  'arr': 'Arroz',
  'mac': 'Macarrão',
  'far': 'Farinha',
  'aç': 'Açúcar',
  'ol': 'Óleo',
  'vin': 'Vinagre',
  'mol': 'Molho',
  'leit': 'Leite',
  'iog': 'Iogurte',
  'requ': 'Requeijão',
  'mant': 'Manteiga',
  'marg': 'Margarina',
  'ouu': 'Ovos',
  'bisc': 'Biscoito',
  'bolacha': 'Bolacha',
  'refrig': 'Refrigerante',
  'refr': 'Refrigerante',
  'suc': 'Suco',
  'floc': 'Flocos',
  'flocao': 'Flocão',
  'caf': 'Café',
  'cha': 'Chá',
  'atum': 'Atum',
  'sard': 'Sardinha',
  'erv': 'Ervilha',
  'milh': 'Milho',
  'bat': 'Batata',
  'ceb': 'Cebola',
  'alh': 'Alho',
  'tom': 'Tomate',

  // --- Descritores / Adjetivos ---
  'bco': 'Branco',
  'bc': 'Branco',
  'pto': 'Preto',
  'pt': 'Preto',
  'verm': 'Vermelho',
  'car': 'Carioca',
  'int': 'Integral',
  'intg': 'Integral',
  'padr': 'Padrão',
  'dem': 'Demerara',
  'him': 'Himalaia',
  'hm': 'Himalaia',
  'lv': 'Leve',
  'po': 'Pó',
  'liq': 'Líquido',
  'liqu': 'Líquido',
  'conc': 'Concentrado',
  'nat': 'Natural',
  'org': 'Orgânico',
  'inteiro': 'Inteiro',
  'desat': 'Desnatado',
  'semia': 'Semidesnatado',
  'mo': 'Moído',

  // --- Embalagem / Apresentação ---
  'pct': 'Pacote',
  'emb': 'Embalagem',
  'fd': 'Fardo',
};

function normalizeToken(token: string): string {
  // Strip leading/trailing punctuation before lookup, restore after
  const match = token.match(/^([^a-zA-ZÀ-ú]*)([a-zA-ZÀ-ú][\w\-À-ú]*)([^a-zA-ZÀ-ú]*)$/);
  if (!match) return token;

  const [, prefix, word, suffix] = match;
  const replacement = TOKEN_MAP[word.toLowerCase()];
  return replacement ? prefix + replacement + suffix : token;
}

export function normalizeName(name: string): string {
  let result = name;

  for (const [pattern, replacement] of PHRASE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  return result.split(/\s+/).map(normalizeToken).join(' ');
}

export function normalizeItems(items: Item[]): Item[] {
  return items.map((item) => ({ ...item, name: normalizeName(item.name) }));
}
