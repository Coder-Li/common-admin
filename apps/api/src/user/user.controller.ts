import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
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
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from './current-user.decorator';
import {
  CreateUserDto,
  ReplaceUserRolesDto,
  ResetUserPasswordDto,
  UpdateUserDto,
  UserListQueryDto,
} from './dto/user.request';
import { UserListResponseDto, UserResponseDto } from './dto/user.response';
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
  @ApiForbiddenResponse({ description: 'Permission required' })
  @Permissions('user.read')
  @Get()
  listUsers(@Query() query: UserListQueryDto): Promise<UserListResponseDto> {
    return this.userService.listUsers(query);
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Permissions('user.read')
  @Get(':id')
  getUser(@Param('id') id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @Permissions('user.create')
  @Post()
  createUser(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.createUser(body);
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Permissions('user.update')
  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(id, body);
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Permissions('user.update')
  @Post(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() body: ResetUserPasswordDto,
  ): Promise<UserResponseDto> {
    return this.userService.resetPassword(id, body.newPassword);
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Permissions('user.assign_roles')
  @Put(':id/roles')
  replaceRoles(
    @Param('id') id: string,
    @Body() body: ReplaceUserRolesDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<UserResponseDto> {
    return this.userService.replaceRoles(id, body.roleCodes, user.sub);
  }

  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Permissions('user.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteUser(@Param('id') id: string): Promise<void> {
    return this.userService.deleteUser(id);
  }
}
