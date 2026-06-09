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
  ): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.createType(body);
  }

  @ApiOkResponse({ type: DictionaryTypeResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @Permissions('dictionary.update')
  @Patch(':id')
  updateType(
    @Param('id') id: string,
    @Body() body: UpdateDictionaryTypeDto,
  ): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.updateType(id, body);
  }

  @ApiNoContentResponse({ description: 'Dictionary type deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @ApiConflictResponse({ description: 'Dictionary type cannot be deleted' })
  @Permissions('dictionary.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteType(@Param('id') id: string): Promise<void> {
    return this.dictionaryTypeService.deleteType(id);
  }
}
