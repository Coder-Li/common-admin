import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  buildAuditActor,
  getAuditRequestMeta,
  withAuditRequestId,
} from '../audit-log/audit-log-request-meta';
import { Permissions } from '../auth/permissions.decorator';
import { getRequestIdFromRequest } from '../common/logging/request-context';
import { CurrentUser } from '../user/current-user.decorator';
import type { JwtUserPayload } from '../user/user.types';
import { UpdateBasicSettingsDto } from './dto/settings-basic.request';
import { BasicSettingsResponseDto } from './dto/settings-basic.response';
import { DictionaryCacheRefreshResponseDto } from './dto/settings-cache.response';
import { SystemInfoResponseDto } from './dto/settings-system-info.response';
import { UpdateUploadSettingsDto } from './dto/settings-upload.request';
import { UploadSettingsResponseDto } from './dto/settings-upload.response';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOkResponse({ type: BasicSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'getBasicSettings' })
  @Permissions('setting.read')
  @Get('basic')
  getBasicSettings(): Promise<BasicSettingsResponseDto> {
    return this.settingsService.getBasicSettings();
  }

  @ApiOkResponse({ type: BasicSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'updateBasicSettings' })
  @Permissions('setting.update')
  @Patch('basic')
  updateBasicSettings(
    @Body() body: UpdateBasicSettingsDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<BasicSettingsResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.settingsService.updateBasicSettings(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: UploadSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'getUploadSettings' })
  @Permissions('setting.read')
  @Get('upload')
  getUploadSettings(): Promise<UploadSettingsResponseDto> {
    return this.settingsService.getUploadSettings();
  }

  @ApiOkResponse({ type: UploadSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'updateUploadSettings' })
  @Permissions('setting.update')
  @Patch('upload')
  updateUploadSettings(
    @Body() body: UpdateUploadSettingsDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<UploadSettingsResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.settingsService.updateUploadSettings(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: DictionaryCacheRefreshResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'refreshDictionaryCache' })
  @Permissions('setting.update')
  @Post('cache/dictionaries/refresh')
  refreshDictionaryCache(
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<DictionaryCacheRefreshResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.settingsService.refreshDictionaryCache(
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: SystemInfoResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'getSystemInfo' })
  @Permissions('setting.read')
  @Get('system-info')
  getSystemInfo(): Promise<SystemInfoResponseDto> {
    return this.settingsService.getSystemInfo();
  }
}
