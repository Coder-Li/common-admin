import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/permissions.decorator';
import {
  PermissionModuleResponseDto,
  PermissionResponseDto,
} from './dto/permission.response';
import { PermissionService } from './permission.service';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @ApiOkResponse({ type: [PermissionResponseDto] })
  @Permissions('permission.read')
  @Get()
  listPermissions(): Promise<PermissionResponseDto[]> {
    return this.permissionService.listPermissions();
  }

  @ApiOkResponse({ type: [PermissionModuleResponseDto] })
  @Permissions('permission.read')
  @Get('modules')
  listPermissionModules(): Promise<PermissionModuleResponseDto[]> {
    return this.permissionService.listPermissionModules();
  }
}
