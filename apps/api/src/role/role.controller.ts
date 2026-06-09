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
  @Permissions('role.read')
  @Get()
  listRoles(@Query() query: RoleListQueryDto): Promise<RoleListResponseDto> {
    return this.roleService.listRoles(query);
  }

  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @Permissions('role.create')
  @Post()
  createRole(@Body() body: CreateRoleDto): Promise<RoleResponseDto> {
    return this.roleService.createRole(body);
  }

  @ApiOkResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @Permissions('role.read')
  @Get(':id')
  getRole(@Param('id') id: string): Promise<RoleResponseDto> {
    return this.roleService.findById(id);
  }

  @ApiOkResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @Permissions('role.update')
  @Patch(':id')
  updateRole(
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.roleService.updateRole(id, body);
  }

  @ApiNoContentResponse({ description: 'Role deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @Permissions('role.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteRole(@Param('id') id: string): Promise<void> {
    return this.roleService.deleteRole(id);
  }

  @ApiOkResponse({ type: RoleResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @Permissions('role.assign_permissions')
  @Put(':id/permissions')
  replaceRolePermissions(
    @Param('id') id: string,
    @Body() body: ReplaceRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    return this.roleService.replaceRolePermissions(id, body.permissionCodes);
  }
}
