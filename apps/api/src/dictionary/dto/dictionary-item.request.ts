import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DictionaryBadgeVariant, DictionaryStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import {
  DICTIONARY_CODE_PATTERN,
  IsPlainRecord,
  transformOptionalBoolean,
} from './dictionary-validation';

const DICTIONARY_ITEM_SORT_FIELDS = [
  'value',
  'label',
  'sortOrder',
  'status',
  'isDefault',
  'createdAt',
  'updatedAt',
];

export class DictionaryItemListQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  typeId?: string;

  @ApiPropertyOptional({ example: 'user_role' })
  @IsOptional()
  @IsString()
  @Matches(DICTIONARY_CODE_PATTERN)
  typeCode?: string;

  @ApiPropertyOptional({ enum: DictionaryStatus })
  @IsOptional()
  @IsEnum(DictionaryStatus)
  status?: DictionaryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    example: 'sortOrder:asc',
    description: `Sort by one of: ${DICTIONARY_ITEM_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(
    new RegExp(`^(${DICTIONARY_ITEM_SORT_FIELDS.join('|')}):(asc|desc)$`),
    {
      message:
        'sort must use an allowed dictionary item field and asc or desc direction',
    },
  )
  declare sort?: string;
}

export class CreateDictionaryItemDto {
  @ApiProperty()
  @IsUUID()
  typeId!: string;

  @ApiProperty({ example: 'ADMIN', minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string;

  @ApiProperty({ example: 'Admin', minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: DictionaryStatus })
  @IsOptional()
  @IsEnum(DictionaryStatus)
  status?: DictionaryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: DictionaryBadgeVariant })
  @IsOptional()
  @IsEnum(DictionaryBadgeVariant)
  badgeVariant?: DictionaryBadgeVariant;

  @ApiPropertyOptional({ type: Object })
  @ValidateIf((_, value) => value !== undefined)
  @IsPlainRecord()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateDictionaryItemDto {
  @ApiPropertyOptional({ example: 'Admin', minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: DictionaryStatus })
  @IsOptional()
  @IsEnum(DictionaryStatus)
  status?: DictionaryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: DictionaryBadgeVariant })
  @IsOptional()
  @IsEnum(DictionaryBadgeVariant)
  badgeVariant?: DictionaryBadgeVariant;

  @ApiPropertyOptional({ type: Object })
  @ValidateIf((_, value) => value !== undefined)
  @IsPlainRecord()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
