import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListResponse } from '../../common/dto/list-response.dto';
import type { UserSessionStatus } from '../user-session.constants';

export class UserSessionUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;
}

export class UserSessionDeviceSummaryDto {
  @ApiProperty()
  browser!: string;

  @ApiProperty()
  os!: string;

  @ApiProperty()
  deviceType!: string;
}

export class UserSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: UserSessionUserSummaryDto })
  user!: UserSessionUserSummaryDto;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiProperty({ type: UserSessionDeviceSummaryDto })
  deviceSummary!: UserSessionDeviceSummaryDto;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  lastUsedAt?: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiPropertyOptional()
  revokedAt?: string;

  @ApiPropertyOptional()
  revokedReason?: string;

  @ApiProperty({ enum: ['active', 'expired', 'revoked'] })
  status!: UserSessionStatus;

  @ApiProperty()
  isCurrentSession!: boolean;
}

export class UserSessionListResponseDto implements ListResponse<UserSessionResponseDto> {
  @ApiProperty({ type: [UserSessionResponseDto] })
  items!: UserSessionResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
