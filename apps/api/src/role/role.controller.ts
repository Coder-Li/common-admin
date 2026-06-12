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
import { CurrentUser } from '../user/current-user.decorator';
import type { JwtUserPayload } from '../user/user.types';
import {
  CreateRoleDto,
  ReplaceRolePermissionsDto,
  RoleListQueryDto,
  UpdateRoleDto,
} from './dto/role.request';
import { RoleListResponseDto, RoleResponseDto } from './dto/role.response';
import { RoleService } from './role.service';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @ApiOkResponse({ type: RoleListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'listRoles' })
  @Permissions('role.read')
  @Get()
  listRoles(@Query() query: RoleListQueryDto): Promise<RoleListResponseDto> {
    return this.roleService.listRoles(query);
  }

  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'createRole' })
  @Permissions('role.create')
  @Post()
  createRole(
    @Body() body: CreateRoleDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<RoleResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.roleService.createRole(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiOperation({ operationId: 'getRole' })
  @Permissions('role.read')
  @Get(':id')
  getRole(@Param('id') id: string): Promise<RoleResponseDto> {
    return this.roleService.findById(id);
  }

  @ApiOkResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiOperation({ operationId: 'updateRole' })
  @Permissions('role.update')
  @Patch(':id')
  updateRole(
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<RoleResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.roleService.updateRole(
      id,
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiNoContentResponse({ description: 'Role deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiOperation({ operationId: 'deleteRole' })
  @Permissions('role.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteRole(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    const requestId = getRequestIdFromRequest(request);

    return this.roleService.deleteRole(
      id,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiOperation({ operationId: 'replaceRolePermissions' })
  @Permissions('role.assign_permissions')
  @Put(':id/permissions')
  replaceRolePermissions(
    @Param('id') id: string,
    @Body() body: ReplaceRolePermissionsDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<RoleResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.roleService.replaceRolePermissions(
      id,
      body.permissionCodes,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }
}
