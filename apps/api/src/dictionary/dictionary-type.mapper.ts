import { DictionaryType } from '@prisma/client';
import { DictionaryTypeResponseDto } from './dto/dictionary-type.response';

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toDictionaryTypeResponse(
  type: DictionaryType,
): DictionaryTypeResponseDto {
  return {
    id: type.id,
    code: type.code,
    name: type.name,
    status: type.status,
    isSystem: type.isSystem,
    createdAt: toIsoString(type.createdAt),
    updatedAt: toIsoString(type.updatedAt),
    ...(type.description !== null ? { description: type.description } : {}),
  };
}
