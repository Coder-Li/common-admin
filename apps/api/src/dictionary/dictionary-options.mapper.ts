import { DictionaryItem, Prisma } from '@prisma/client';
import { DictionaryOptionDto } from './dto/dictionary-options.response';

function toMetadataObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

export function toDictionaryOption(item: DictionaryItem): DictionaryOptionDto {
  const metadata = toMetadataObject(item.metadata);

  return {
    value: item.value,
    label: item.label,
    isDefault: item.isDefault,
    ...(item.badgeVariant ? { badgeVariant: item.badgeVariant } : {}),
    ...(metadata ? { metadata } : {}),
  };
}
