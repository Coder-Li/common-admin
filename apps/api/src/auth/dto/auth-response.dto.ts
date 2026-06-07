import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../user/role.enum';
import type { UserProfile } from '../../user/user.types';

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

  @ApiProperty({ enum: Role })
  role!: Role;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfile;
}
