import { ApiProperty } from '@nestjs/swagger';
import type { UserProfile } from '../../user/user.types';

class UserRoleSummaryDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;
}

class UserProfileDto implements UserProfile {
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

  @ApiProperty({ type: [UserRoleSummaryDto] })
  roles!: UserRoleSummaryDto[];

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfile;
}
