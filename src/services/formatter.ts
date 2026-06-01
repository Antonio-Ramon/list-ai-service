import { Item } from '../types';

export type FormatType = 'asterisk' | 'checklist';

export function format(items: Item[], formatType: FormatType = 'asterisk'): string {
  if (items.length === 0) return '';
  return items
    .map((item) => {
      const prefix = formatType === 'checklist' ? '[ ]' : '*';
      return `${prefix} ${item.name}   ${item.quantity}${item.unit}`;
    })
    .join('\n');
}
