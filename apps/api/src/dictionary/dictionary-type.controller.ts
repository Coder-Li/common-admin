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
  ApiTags,
} from '@nestjs/swagger';
import {
  buildAuditActor,
  getAuditRequestMeta,
} from '../audit-log/audit-log-request-meta';
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../user/current-user.decorator';
import type { JwtUserPayload } from '../user/user.types';
import {
  CreateDictionaryTypeDto,
  DictionaryTypeListQueryDto,
  UpdateDictionaryTypeDto,
} from './dto/dictionary-type.request';
import {
  DictionaryTypeListResponseDto,
  DictionaryTypeResponseDto,
} from './dto/dictionary-type.response';
import { DictionaryTypeService } from './dictionary-type.service';

@ApiTags('Dictionary Types')
@ApiBearerAuth('access-token')
@Controller('dictionary-types')
export class DictionaryTypeController {
  constructor(private readonly dictionaryTypeService: DictionaryTypeService) {}

  @ApiOkResponse({ type: DictionaryTypeListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @Permissions('dictionary.read')
  @Get()
  listTypes(
    @Query() query: DictionaryTypeListQueryDto,
  ): Promise<DictionaryTypeListResponseDto> {
    return this.dictionaryTypeService.listTypes(query);
  }

  @ApiOkResponse({ type: DictionaryTypeResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @Permissions('dictionary.read')
  @Get(':id')
  getType(@Param('id') id: string): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.findById(id);
  }

  @ApiCreatedResponse({ type: DictionaryTypeResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({ description: 'Dictionary type already exists' })
  @Permissions('dictionary.create')
  @Post()
  createType(
    @Body() body: CreateDictionaryTypeDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.createType(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }

  @ApiOkResponse({ type: DictionaryTypeResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @Permissions('dictionary.update')
  @Patch(':id')
  updateType(
    @Param('id') id: string,
    @Body() body: UpdateDictionaryTypeDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.updateType(
      id,
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }

  @ApiNoContentResponse({ description: 'Dictionary type deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @ApiConflictResponse({ description: 'Dictionary type cannot be deleted' })
  @Permissions('dictionary.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteType(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    return this.dictionaryTypeService.deleteType(
      id,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }
}
