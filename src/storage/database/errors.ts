export type StorageErrorCode =
  | 'INITIALIZATION_FAILED'
  | 'MIGRATION_FAILED'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'NOT_FOUND'
  | 'REVISION_CONFLICT'
  | 'INVALID_DATA';

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function toStorageError(
  error: unknown,
  fallbackCode: StorageErrorCode,
  fallbackMessage: string,
  retryable = true,
): StorageError {
  if (error instanceof StorageError) {
    return error;
  }

  return new StorageError(fallbackCode, fallbackMessage, retryable);
}
