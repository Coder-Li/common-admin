import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { UserSessionListQueryDto } from './dto/user-session.request';
import { UserSessionListResponseDto } from './dto/user-session.response';
import { UserSessionService } from './user-session.service';

@ApiTags('User Sessions')
@ApiBearerAuth('access-token')
@Controller('user-sessions')
export class UserSessionController {
  constructor(private readonly userSessionService: UserSessionService) {}

  @ApiOkResponse({ type: UserSessionListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiBadRequestResponse({ description: 'Query validation failed' })
  @ApiOperation({ operationId: 'listUserSessions' })
  @Permissions('user_session.read')
  @Get()
  listUserSessions(
    @Query() query: UserSessionListQueryDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<UserSessionListResponseDto> {
    return this.userSessionService.listUserSessions(query, user.sid);
  }

  @ApiNoContentResponse({ description: 'User session revoked' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'User session not found' })
  @ApiBadRequestResponse({
    description: 'Session cannot be revoked or query validation failed',
  })
  @ApiOperation({ operationId: 'revokeUserSession' })
  @Permissions('user_session.revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/revoke')
  revokeUserSession(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    const requestId = getRequestIdFromRequest(request);

    return this.userSessionService.revokeUserSession(
      id,
      user.sid,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }
}
