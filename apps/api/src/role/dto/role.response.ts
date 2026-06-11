import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleStatus } from '@prisma/client';
import { ListResponse } from '../../common/dto/list-response.dto';

export class RolePermissionSummaryDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

export class RoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ enum: RoleStatus })
  status!: RoleStatus;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty({ type: [RolePermissionSummaryDto] })
  permissions!: RolePermissionSummaryDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class RoleListResponseDto implements ListResponse<RoleResponseDto> {
  @ApiProperty({ type: [RoleResponseDto] })
  items!: RoleResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
