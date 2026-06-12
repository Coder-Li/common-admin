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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  buildAuditActor,
  getAuditRequestMeta,
  withAuditRequestId,
} from '../audit-log/audit-log-request-meta';
import { Permissions } from '../auth/permissions.decorator';
import { getRequestIdFromRequest } from '../common/logging/request-context';
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
  @ApiOperation({ operationId: 'getCurrentUser' })
  @Get('me')
  getMe(@CurrentUser() user: JwtUserPayload): Promise<UserProfile> {
    return this.userService.findProfileById(user.sub);
  }

  @ApiOkResponse({ type: UserListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'listUsers' })
  @Permissions('user.read')
  @Get()
  listUsers(@Query() query: UserListQueryDto): Promise<UserListResponseDto> {
    return this.userService.listUsers(query);
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiOperation({ operationId: 'getUser' })
  @Permissions('user.read')
  @Get(':id')
  getUser(@Param('id') id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'createUser' })
  @Permissions('user.create')
  @Post()
  createUser(
    @Body() body: CreateUserDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<UserResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.userService.createUser(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiOperation({ operationId: 'updateUser' })
  @Permissions('user.update')
  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<UserResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.userService.updateUser(
      id,
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiOperation({ operationId: 'resetUserPassword' })
  @Permissions('user.update')
  @Post(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() body: ResetUserPasswordDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<UserResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.userService.resetPassword(
      id,
      body.newPassword,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiOperation({ operationId: 'replaceUserRoles' })
  @Permissions('user.assign_roles')
  @Put(':id/roles')
  replaceRoles(
    @Param('id') id: string,
    @Body() body: ReplaceUserRolesDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<UserResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.userService.replaceRoles(
      id,
      body.roleCodes,
      user.sub,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiOperation({ operationId: 'deleteUser' })
  @Permissions('user.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    const requestId = getRequestIdFromRequest(request);

    return this.userService.deleteUser(
      id,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }
}
