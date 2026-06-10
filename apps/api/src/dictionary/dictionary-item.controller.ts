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
} from '../audit-log/audit-log-request-meta';
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../user/current-user.decorator';
import type { JwtUserPayload } from '../user/user.types';
import { DictionaryItemService } from './dictionary-item.service';
import {
  CreateDictionaryItemDto,
  DictionaryItemListQueryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary-item.request';
import {
  DictionaryItemListResponseDto,
  DictionaryItemResponseDto,
} from './dto/dictionary-item.response';

@ApiTags('Dictionary Items')
@ApiBearerAuth('access-token')
@Controller('dictionary-items')
export class DictionaryItemController {
  constructor(private readonly dictionaryItemService: DictionaryItemService) {}

  @ApiOkResponse({ type: DictionaryItemListResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'listDictionaryItems' })
  @Permissions('dictionary.read')
  @Get()
  listItems(
    @Query() query: DictionaryItemListQueryDto,
  ): Promise<DictionaryItemListResponseDto> {
    return this.dictionaryItemService.listItems(query);
  }

  @ApiOkResponse({ type: DictionaryItemResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Dictionary item not found' })
  @ApiOperation({ operationId: 'getDictionaryItem' })
  @Permissions('dictionary.read')
  @Get(':id')
  getItem(@Param('id') id: string): Promise<DictionaryItemResponseDto> {
    return this.dictionaryItemService.findById(id);
  }

  @ApiCreatedResponse({ type: DictionaryItemResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({ description: 'Dictionary item already exists' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @ApiOperation({ operationId: 'createDictionaryItem' })
  @Permissions('dictionary.create')
  @Post()
  createItem(
    @Body() body: CreateDictionaryItemDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<DictionaryItemResponseDto> {
    return this.dictionaryItemService.createItem(
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }

  @ApiOkResponse({ type: DictionaryItemResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({ description: 'System dictionary item constraint' })
  @ApiNotFoundResponse({ description: 'Dictionary item not found' })
  @ApiOperation({ operationId: 'updateDictionaryItem' })
  @Permissions('dictionary.update')
  @Patch(':id')
  updateItem(
    @Param('id') id: string,
    @Body() body: UpdateDictionaryItemDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<DictionaryItemResponseDto> {
    return this.dictionaryItemService.updateItem(
      id,
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }

  @ApiNoContentResponse({ description: 'Dictionary item deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({
    description: 'System dictionary item cannot be deleted',
  })
  @ApiNotFoundResponse({ description: 'Dictionary item not found' })
  @ApiOperation({ operationId: 'deleteDictionaryItem' })
  @Permissions('dictionary.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    return this.dictionaryItemService.deleteItem(
      id,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }
}
