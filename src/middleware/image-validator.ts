import { MultipartFile } from '@fastify/multipart';
import { config } from '../config';
import { FileTooLargeError, InvalidFileTypeError, MissingFileError } from '../errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ValidatedImage {
  buffer: Buffer;
  mimeType: string;
}

export async function validateImage(file: MultipartFile | undefined): Promise<ValidatedImage> {
  if (!file) {
    throw new MissingFileError('Nenhum arquivo enviado.');
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new InvalidFileTypeError('Formato inválido. Use JPEG, PNG ou WEBP.');
  }
  const buffer = await file.toBuffer();
  if (buffer.length > config.maxFileSizeMb * 1024 * 1024) {
    throw new FileTooLargeError('Arquivo muito grande. O tamanho máximo é 10 MB.');
  }
  return { buffer, mimeType: file.mimetype };
}
