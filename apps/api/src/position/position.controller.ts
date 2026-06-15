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
  ApiBadRequestResponse,
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
import {
  CreatePositionDto,
  PositionListQueryDto,
  PositionOptionsQueryDto,
  UpdatePositionDto,
} from './dto/position.request';
import {
  PositionListResponseDto,
  PositionOptionDto,
  PositionResponseDto,
} from './dto/position.response';
import { PositionService } from './position.service';

@ApiTags('Positions')
@ApiBearerAuth('access-token')
@Controller('positions')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  @ApiOkResponse({ type: PositionListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'listPositions' })
  @Permissions('position.read')
  @Get()
  listPositions(
    @Query() query: PositionListQueryDto,
  ): Promise<PositionListResponseDto> {
    return this.positionService.listPositions(query);
  }

  @ApiOkResponse({ type: [PositionOptionDto] })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'getPositionOptions' })
  @Permissions('position.read')
  @Get('options')
  getPositionOptions(
    @Query() query: PositionOptionsQueryDto,
  ): Promise<PositionOptionDto[]> {
    return this.positionService.getPositionOptions(query);
  }

  @ApiOkResponse({ type: PositionResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Position not found' })
  @ApiOperation({ operationId: 'getPosition' })
  @Permissions('position.read')
  @Get(':id')
  getPosition(@Param('id') id: string): Promise<PositionResponseDto> {
    return this.positionService.findById(id);
  }

  @ApiCreatedResponse({ type: PositionResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({ description: 'Position already exists' })
  @ApiOperation({ operationId: 'createPosition' })
  @Permissions('position.create')
  @Post()
  createPosition(
    @Body() body: CreatePositionDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<PositionResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.positionService.createPosition(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiOkResponse({ type: PositionResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Position not found' })
  @ApiConflictResponse({ description: 'Position already exists' })
  @ApiOperation({ operationId: 'updatePosition' })
  @Permissions('position.update')
  @Patch(':id')
  updatePosition(
    @Param('id') id: string,
    @Body() body: UpdatePositionDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<PositionResponseDto> {
    const requestId = getRequestIdFromRequest(request);

    return this.positionService.updatePosition(
      id,
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }

  @ApiNoContentResponse({ description: 'Position deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Position not found' })
  @ApiBadRequestResponse({ description: 'Position cannot be deleted' })
  @ApiOperation({ operationId: 'deletePosition' })
  @Permissions('position.delete')
  @HttpCode(204)
  @Delete(':id')
  deletePosition(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    const requestId = getRequestIdFromRequest(request);

    return this.positionService.deletePosition(
      id,
      buildAuditActor(user),
      getAuditRequestMeta(request),
      withAuditRequestId(undefined, requestId),
    );
  }
}
