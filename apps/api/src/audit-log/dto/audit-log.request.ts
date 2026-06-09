import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import {
  AUDIT_ACTIONS,
  AUDIT_LOG_SORT_FIELDS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log.constants';

const AUDIT_LOG_SORT_FIELD_VALUES = [...AUDIT_LOG_SORT_FIELDS];
const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS);
const AUDIT_RESOURCE_TYPE_VALUES = Object.values(AUDIT_RESOURCE_TYPES);

export class AuditLogListQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(120)
  actorUserId?: string;

  @ApiPropertyOptional({ enum: AUDIT_ACTION_VALUES })
  @IsOptional()
  @IsIn(AUDIT_ACTION_VALUES)
  action?: string;

  @ApiPropertyOptional({ enum: AUDIT_RESOURCE_TYPE_VALUES })
  @IsOptional()
  @IsIn(AUDIT_RESOURCE_TYPE_VALUES)
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(120)
  resourceId?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: `Sort by one of: ${AUDIT_LOG_SORT_FIELD_VALUES.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(
    new RegExp(`^(${AUDIT_LOG_SORT_FIELD_VALUES.join('|')}):(asc|desc)$`),
    {
      message:
        'sort must use an allowed audit log field and asc or desc direction',
    },
  )
  declare sort?: string;
}
