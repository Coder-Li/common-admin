import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from './current-user.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
} from './dto/user.request';
import { UserListResponseDto, UserResponseDto } from './dto/user.response';
import { Role } from './role.enum';
import { UserService } from './user.service';
import type { UserProfile, JwtUserPayload } from './user.types';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Get('me')
  getMe(@CurrentUser() user: JwtUserPayload): Promise<UserProfile> {
    return this.userService.findProfileById(user.sub);
  }

  @ApiOkResponse({ type: UserListResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @Roles(Role.ADMIN)
  @Get()
  listUsers(
    @Query() query: UserListQueryDto,
  ): Promise<UserListResponseDto> {
    return this.userService.listUsers(query);
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Roles(Role.ADMIN)
  @Get(':id')
  getUser(@Param('id') id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @Roles(Role.ADMIN)
  @Post()
  createUser(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.createUser(body);
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Roles(Role.ADMIN)
  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(id, body);
  }

  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Roles(Role.ADMIN)
  @HttpCode(204)
  @Delete(':id')
  deleteUser(@Param('id') id: string): Promise<void> {
    return this.userService.deleteUser(id);
  }
}
