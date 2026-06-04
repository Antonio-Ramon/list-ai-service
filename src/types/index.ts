export type ErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'MISSING_FILE'
  | 'NO_ITEMS_FOUND'
  | 'INTERNAL_ERROR';

export interface Item {
  name: string;
  quantity: number;
  unit: string;
  price?: number;
}

export interface ExtractResponse {
  success: true;
  text: string;
  items: Item[];
  total_items: number;
}

export interface ErrorResponse {
  success: false;
  error: ErrorCode;
  message: string;
}
