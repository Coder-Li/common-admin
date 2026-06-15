import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PositionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { POSITION_SORT_FIELDS } from '../position.constants';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class PositionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: PositionStatus })
  @IsOptional()
  @IsEnum(PositionStatus)
  status?: PositionStatus;

  @ApiPropertyOptional({
    example: 'sortOrder:asc',
    description: `Sort by one of: ${POSITION_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^(${POSITION_SORT_FIELDS.join('|')}):(asc|desc)$`), {
    message:
      'sort must use an allowed position field and asc or desc direction',
  })
  declare sort?: string;
}

export class PositionOptionsQueryDto {
  @ApiPropertyOptional({ enum: PositionStatus })
  @IsOptional()
  @IsEnum(PositionStatus)
  status?: PositionStatus;

  @ApiPropertyOptional({
    description: 'Comma-separated position ids to include in the result.',
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  includeIds?: string;
}

export class CreatePositionDto {
  @ApiProperty({
    example: 'platform-engineer',
    maxLength: 80,
    description: 'Stable lowercase snake-case or kebab-case position code.',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code!: string;

  @ApiProperty({ example: 'Platform Engineer', maxLength: 120 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: PositionStatus })
  @IsOptional()
  @IsEnum(PositionStatus)
  status?: PositionStatus;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdatePositionDto {
  @ApiPropertyOptional({
    example: 'platform-engineer',
    maxLength: 80,
    description: 'Stable lowercase snake-case or kebab-case position code.',
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code?: string;

  @ApiPropertyOptional({ example: 'Platform Engineer', maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: PositionStatus })
  @IsOptional()
  @IsEnum(PositionStatus)
  status?: PositionStatus;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
