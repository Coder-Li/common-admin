import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentStatus } from '@prisma/client';
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
import { DEPARTMENT_SORT_FIELDS } from '../department.constants';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class DepartmentListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: DepartmentStatus })
  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    example: 'sortOrder:asc',
    description: `Sort by one of: ${DEPARTMENT_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^(${DEPARTMENT_SORT_FIELDS.join('|')}):(asc|desc)$`), {
    message:
      'sort must use an allowed department field and asc or desc direction',
  })
  declare sort?: string;
}

export class DepartmentOptionsQueryDto {
  @ApiPropertyOptional({ enum: DepartmentStatus })
  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;

  @ApiPropertyOptional({
    description: 'Comma-separated department ids to include in the result.',
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  includeIds?: string;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'engineering', maxLength: 80 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code!: string;

  @ApiProperty({ example: 'Engineering', maxLength: 120 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ enum: DepartmentStatus })
  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;

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

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'engineering', maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code?: string;

  @ApiPropertyOptional({ example: 'Engineering', maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ enum: DepartmentStatus })
  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;

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
