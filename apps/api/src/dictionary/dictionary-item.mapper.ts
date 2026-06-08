import { DictionaryItem, Prisma } from '@prisma/client';
import { DictionaryItemResponseDto } from './dto/dictionary-item.response';

export type DictionaryItemWithType = DictionaryItem & {
  type: {
    code: string;
    name: string;
  };
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toMetadataObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

export function toDictionaryItemResponse(
  item: DictionaryItemWithType,
): DictionaryItemResponseDto {
  const metadata = toMetadataObject(item.metadata);

  return {
    id: item.id,
    typeId: item.typeId,
    typeCode: item.type.code,
    typeName: item.type.name,
    value: item.value,
    label: item.label,
    sortOrder: item.sortOrder,
    status: item.status,
    isSystem: item.isSystem,
    isDefault: item.isDefault,
    createdAt: toIsoString(item.createdAt),
    updatedAt: toIsoString(item.updatedAt),
    ...(item.badgeVariant ? { badgeVariant: item.badgeVariant } : {}),
    ...(metadata ? { metadata } : {}),
    ...(item.description !== null ? { description: item.description } : {}),
  };
}
