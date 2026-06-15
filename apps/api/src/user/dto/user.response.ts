import { ApiProperty } from '@nestjs/swagger';
import { ListResponse } from '../../common/dto/list-response.dto';
import type { PublicUser } from '../user.types';

class UserRoleResponseDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

class UserOrganizationSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  status!: string;
}

export class UserResponseDto implements PublicUser {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ type: [UserRoleResponseDto] })
  roles!: UserRoleResponseDto[];

  @ApiProperty({ type: [UserOrganizationSummaryDto] })
  departments!: UserOrganizationSummaryDto[];

  @ApiProperty({ type: UserOrganizationSummaryDto, nullable: true })
  primaryDepartment!: UserOrganizationSummaryDto | null;

  @ApiProperty({ type: [UserOrganizationSummaryDto] })
  positions!: UserOrganizationSummaryDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class UserListResponseDto implements ListResponse<UserResponseDto> {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
