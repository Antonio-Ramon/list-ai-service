import createError from '@fastify/error';

export const InvalidFileTypeError = createError('INVALID_FILE_TYPE', '%s', 400);
export const FileTooLargeError    = createError('FILE_TOO_LARGE', '%s', 400);
export const MissingFileError     = createError('MISSING_FILE', '%s', 400);
export const NoItemsFoundError    = createError('NO_ITEMS_FOUND', '%s', 422);
export const InternalError        = createError('INTERNAL_ERROR', '%s', 500);
