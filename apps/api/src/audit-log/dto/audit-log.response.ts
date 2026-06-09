import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListResponse } from '../../common/dto/list-response.dto';

export class AuditLogListItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  actorUserId?: string;

  @ApiPropertyOptional()
  actorEmail?: string;

  @ApiPropertyOptional()
  actorName?: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  resourceType!: string;

  @ApiPropertyOptional()
  resourceId?: string;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiProperty()
  createdAt!: string;
}

export class AuditLogResponseDto extends AuditLogListItemResponseDto {
  @ApiPropertyOptional({ type: Object, nullable: true })
  before?: unknown;

  @ApiPropertyOptional({ type: Object, nullable: true })
  after?: unknown;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata?: unknown;

  @ApiPropertyOptional()
  userAgent?: string;
}

export class AuditLogListResponseDto implements ListResponse<AuditLogListItemResponseDto> {
  @ApiProperty({ type: [AuditLogListItemResponseDto] })
  items!: AuditLogListItemResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
