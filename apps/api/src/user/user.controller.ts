import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import type { UserProfile, JwtUserPayload } from './user.types';
import { UserService } from './user.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtUserPayload): Promise<UserProfile> {
    return this.userService.findProfileById(user.sub);
  }
}
