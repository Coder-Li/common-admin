import type { FileStorageDriver } from '@prisma/client';

export interface StoredObject {
  bucket: string | null;
  objectKey: string;
  checksum?: string;
}

export interface StorageReadResult {
  stream: NodeJS.ReadableStream;
  size: number;
}

export interface SaveFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  extension: string | null;
}

export interface StorageService {
  readonly driver: FileStorageDriver;
  save(input: SaveFileInput): Promise<StoredObject>;
  read(object: StoredObject): Promise<StorageReadResult>;
  delete(object: StoredObject): Promise<void>;
}
