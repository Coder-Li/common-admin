import type { ManagedFile } from '@prisma/client';
import type { FileResponseDto } from './dto/file.response';

export function toFileResponse(file: ManagedFile): FileResponseDto {
  return {
    id: file.id,
    originalName: file.originalName,
    displayName: file.displayName,
    mimeType: file.mimeType,
    extension: file.extension,
    size: file.size.toString(),
    storageDriver: file.storageDriver,
    visibility: file.visibility,
    description: file.description,
    metadata: file.metadata as Record<string, unknown> | null,
    uploadedById: file.uploadedById,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}
