import { Item } from '../types';

export type FormatType = 'asterisk' | 'checklist' | 'simple' | 'excel';

function formatPrice(price?: number): string {
  if (price === undefined) return '';
  return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

function formatLine(item: Item, prefix: string): string {
  const price = formatPrice(item.price);
  const parts = [`${prefix} ${item.name}`, `${item.quantity}${item.unit}`];
  if (price) parts.push(price);
  return parts.join('   ');
}

export function format(items: Item[], formatType: FormatType = 'asterisk'): string {
  if (items.length === 0) return '';

  if (formatType === 'excel') {
    const header = 'Nome\tQuantidade\tUnidade\tPreço';
    const rows = items.map((item) => {
      const price = item.price !== undefined ? formatPrice(item.price) : '';
      return `${item.name}\t${item.quantity}\t${item.unit}\t${price}`;
    });
    return [header, ...rows].join('\n');
  }

  return items
    .map((item) => {
      if (formatType === 'simple') return formatLine(item, '').trimStart();
      const prefix = formatType === 'checklist' ? '[ ]' : '*';
      return formatLine(item, prefix);
    })
    .join('\n');
}
