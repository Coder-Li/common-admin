import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DictionaryStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import {
  DICTIONARY_CODE_PATTERN,
  transformOptionalBoolean,
} from './dictionary-validation';

const DICTIONARY_TYPE_SORT_FIELDS = [
  'code',
  'name',
  'status',
  'isSystem',
  'createdAt',
  'updatedAt',
];

export class DictionaryTypeListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: DictionaryStatus })
  @IsOptional()
  @IsEnum(DictionaryStatus)
  status?: DictionaryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: `Sort by one of: ${DICTIONARY_TYPE_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^(${DICTIONARY_TYPE_SORT_FIELDS.join('|')}):(asc|desc)$`), {
    message:
      'sort must use an allowed dictionary type field and asc or desc direction',
  })
  declare sort?: string;
}

export class CreateDictionaryTypeDto {
  @ApiProperty({ example: 'user_role', minLength: 2, maxLength: 80 })
  @IsString()
  @Matches(DICTIONARY_CODE_PATTERN)
  code!: string;

  @ApiProperty({ example: 'User role', minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: DictionaryStatus })
  @IsOptional()
  @IsEnum(DictionaryStatus)
  status?: DictionaryStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateDictionaryTypeDto {
  @ApiPropertyOptional({ example: 'User role', minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: DictionaryStatus })
  @IsOptional()
  @IsEnum(DictionaryStatus)
  status?: DictionaryStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
