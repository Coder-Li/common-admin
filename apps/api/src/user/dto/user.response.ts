import { ApiProperty } from '@nestjs/swagger';
import { ListResponse } from '../../common/dto/list-response.dto';
import type { PublicUser } from '../user.types';

class UserRoleResponseDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
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
