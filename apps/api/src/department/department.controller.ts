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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { DepartmentService } from './department.service';
import {
  CreateDepartmentDto,
  DepartmentListQueryDto,
  DepartmentOptionsQueryDto,
  UpdateDepartmentDto,
} from './dto/department.request';
import {
  DepartmentListResponseDto,
  DepartmentOptionDto,
  DepartmentResponseDto,
  DepartmentTreeNodeDto,
} from './dto/department.response';

@ApiTags('Departments')
@ApiBearerAuth('access-token')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @ApiOkResponse({ type: DepartmentListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'listDepartments' })
  @Permissions('department.read')
  @Get()
  listDepartments(
    @Query() query: DepartmentListQueryDto,
  ): Promise<DepartmentListResponseDto> {
    return this.departmentService.listDepartments(query);
  }

  @ApiOkResponse({ type: [DepartmentTreeNodeDto] })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'getDepartmentTree' })
  @Permissions('department.read')
  @Get('tree')
  getDepartmentTree(): Promise<DepartmentTreeNodeDto[]> {
    return this.departmentService.getDepartmentTree();
  }

  @ApiOkResponse({ type: [DepartmentOptionDto] })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'getDepartmentOptions' })
  @Permissions('department.read')
  @Get('options')
  getDepartmentOptions(
    @Query() query: DepartmentOptionsQueryDto,
  ): Promise<DepartmentOptionDto[]> {
    return this.departmentService.getDepartmentOptions(query);
  }

  @ApiOkResponse({ type: DepartmentResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Department not found' })
  @ApiOperation({ operationId: 'getDepartment' })
  @Permissions('department.read')
  @Get(':id')
  getDepartment(@Param('id') id: string): Promise<DepartmentResponseDto> {
    return this.departmentService.findById(id);
  }

  @ApiCreatedResponse({ type: DepartmentResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({ description: 'Department already exists' })
  @ApiOperation({ operationId: 'createDepartment' })
  @Permissions('department.create')
  @Post()
  createDepartment(
    @Body() body: CreateDepartmentDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<DepartmentResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.departmentService.createDepartment(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: DepartmentResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Department not found' })
  @ApiConflictResponse({ description: 'Department already exists' })
  @ApiOperation({ operationId: 'updateDepartment' })
  @Permissions('department.update')
  @Patch(':id')
  updateDepartment(
    @Param('id') id: string,
    @Body() body: UpdateDepartmentDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<DepartmentResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.departmentService.updateDepartment(
      id,
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiNoContentResponse({ description: 'Department deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Department not found' })
  @ApiConflictResponse({ description: 'Department cannot be deleted' })
  @ApiOperation({ operationId: 'deleteDepartment' })
  @Permissions('department.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteDepartment(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    const requestId = getRequestIdFromRequest(request);

    return this.departmentService.deleteDepartment(
      id,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }
}
