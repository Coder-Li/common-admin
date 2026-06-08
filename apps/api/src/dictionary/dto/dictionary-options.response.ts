import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DictionaryBadgeVariant } from '@prisma/client';

export class DictionaryOptionDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  isDefault!: boolean;

  @ApiPropertyOptional({ enum: DictionaryBadgeVariant })
  badgeVariant?: DictionaryBadgeVariant;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown>;
}

export class DictionaryOptionsResponseDto {
  @ApiProperty()
  typeCode!: string;

  @ApiProperty({ type: [DictionaryOptionDto] })
  items!: DictionaryOptionDto[];
}

export class DictionaryOptionsMapResponseDto {
  @ApiProperty({
    additionalProperties: {
      type: 'array',
      items: { $ref: '#/components/schemas/DictionaryOptionDto' },
    },
  })
  dictionaries!: Record<string, DictionaryOptionDto[]>;
}
