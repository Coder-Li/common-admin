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
} from '@nestjs/common';
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
import { Permissions } from '../auth/permissions.decorator';
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
  @Permissions('dictionary.read')
  @Get(':id')
  getItem(@Param('id') id: string): Promise<DictionaryItemResponseDto> {
    return this.dictionaryItemService.findById(id);
  }

  @ApiCreatedResponse({ type: DictionaryItemResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({ description: 'Dictionary item already exists' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @Permissions('dictionary.create')
  @Post()
  createItem(
    @Body() body: CreateDictionaryItemDto,
  ): Promise<DictionaryItemResponseDto> {
    return this.dictionaryItemService.createItem(body);
  }

  @ApiOkResponse({ type: DictionaryItemResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({ description: 'System dictionary item constraint' })
  @ApiNotFoundResponse({ description: 'Dictionary item not found' })
  @Permissions('dictionary.update')
  @Patch(':id')
  updateItem(
    @Param('id') id: string,
    @Body() body: UpdateDictionaryItemDto,
  ): Promise<DictionaryItemResponseDto> {
    return this.dictionaryItemService.updateItem(id, body);
  }

  @ApiNoContentResponse({ description: 'Dictionary item deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConflictResponse({
    description: 'System dictionary item cannot be deleted',
  })
  @ApiNotFoundResponse({ description: 'Dictionary item not found' })
  @Permissions('dictionary.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteItem(@Param('id') id: string): Promise<void> {
    return this.dictionaryItemService.deleteItem(id);
  }
}
