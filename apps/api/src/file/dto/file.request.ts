import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileStorageDriver } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

const FILE_SORT_FIELDS = [
  'displayName',
  'mimeType',
  'size',
  'storageDriver',
  'createdAt',
  'updatedAt',
];

const MAX_METADATA_BYTES = 16 * 1024;
const MAX_METADATA_DEPTH = 5;

export class FileListQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ enum: FileStorageDriver })
  @IsOptional()
  @IsEnum(FileStorageDriver)
  storageDriver?: FileStorageDriver;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: `Sort by one of: ${FILE_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^(${FILE_SORT_FIELDS.join('|')}):(asc|desc)$`), {
    message: 'sort must use an allowed file field and asc or desc direction',
  })
  declare sort?: string;
}

export class UploadFileMetadataDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(({ value }) => transformOptionalTrimmedString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(({ value }) => transformOptionalNullableTrimmedString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @Transform(({ value }) => parseMultipartMetadata(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

@ValidatorConstraint({ name: 'hasUpdateFileFields' })
class HasUpdateFileFieldsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return hasUpdateFileFields(args.object as UpdateFileDto);
  }

  defaultMessage(): string {
    return 'at least one file field must be provided';
  }
}

export class UpdateFileDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(({ value }) => transformOptionalTrimmedString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @Transform(({ value }) => transformOptionalNullableTrimmedString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @Transform(({ value }) => validateMetadataShape(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @Validate(HasUpdateFileFieldsConstraint)
  private readonly atLeastOneField = true;
}

export function parseMultipartMetadata(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return validateMetadataShape(value);
  }

  try {
    return validateMetadataShape(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException('metadata must be valid JSON');
  }
}

export function validateMetadataShape(
  value: unknown,
): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw new BadRequestException('metadata must be a JSON object or null');
  }

  const serialized = JSON.stringify(value);

  if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw new BadRequestException('metadata must be 16 KB or smaller');
  }

  if (getDepth(value) > MAX_METADATA_DEPTH) {
    throw new BadRequestException('metadata nesting depth must be at most 5');
  }

  return value;
}

export function hasUpdateFileFields(dto: UpdateFileDto): boolean {
  return (
    dto.displayName !== undefined ||
    dto.description !== undefined ||
    dto.metadata !== undefined
  );
}

function transformOptionalTrimmedString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function transformOptionalNullableTrimmedString(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function getDepth(value: unknown): number {
  if (!isPlainObject(value)) {
    return 0;
  }

  const childDepths = Object.values(value).map((child) => getDepth(child));

  return 1 + Math.max(0, ...childDepths);
}
