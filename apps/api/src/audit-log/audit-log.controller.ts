import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../auth/permissions.decorator';
import { AuditLogService } from './audit-log.service';
import { AuditLogListQueryDto } from './dto/audit-log.request';
import {
  AuditLogListResponseDto,
  AuditLogResponseDto,
} from './dto/audit-log.response';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @ApiOkResponse({ type: AuditLogListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @Permissions('audit_log.read')
  @Get()
  listAuditLogs(
    @Query() query: AuditLogListQueryDto,
  ): Promise<AuditLogListResponseDto> {
    return this.auditLogService.listAuditLogs(query);
  }

  @ApiOkResponse({ type: AuditLogResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Audit log not found' })
  @Permissions('audit_log.read')
  @Get(':id')
  getAuditLog(@Param('id') id: string): Promise<AuditLogResponseDto> {
    return this.auditLogService.findById(id);
  }
}
