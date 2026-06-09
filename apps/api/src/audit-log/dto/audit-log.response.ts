import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListResponse } from '../../common/dto/list-response.dto';

export class AuditLogListItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  actorUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  actorEmail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  actorName!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  resourceType!: string;

  @ApiPropertyOptional({ nullable: true })
  resourceId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ipAddress!: string | null;

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

  @ApiPropertyOptional({ nullable: true })
  userAgent?: string | null;
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
