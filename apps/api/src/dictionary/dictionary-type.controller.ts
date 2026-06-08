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
import { Roles } from '../auth/roles.decorator';
import { Role } from '../user/role.enum';
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
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @Roles(Role.ADMIN)
  @Get()
  listTypes(
    @Query() query: DictionaryTypeListQueryDto,
  ): Promise<DictionaryTypeListResponseDto> {
    return this.dictionaryTypeService.listTypes(query);
  }

  @ApiOkResponse({ type: DictionaryTypeResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @Roles(Role.ADMIN)
  @Get(':id')
  getType(@Param('id') id: string): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.findById(id);
  }

  @ApiCreatedResponse({ type: DictionaryTypeResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiConflictResponse({ description: 'Dictionary type already exists' })
  @Roles(Role.ADMIN)
  @Post()
  createType(
    @Body() body: CreateDictionaryTypeDto,
  ): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.createType(body);
  }

  @ApiOkResponse({ type: DictionaryTypeResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @Roles(Role.ADMIN)
  @Patch(':id')
  updateType(
    @Param('id') id: string,
    @Body() body: UpdateDictionaryTypeDto,
  ): Promise<DictionaryTypeResponseDto> {
    return this.dictionaryTypeService.updateType(id, body);
  }

  @ApiNoContentResponse({ description: 'Dictionary type deleted' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'Dictionary type not found' })
  @ApiConflictResponse({ description: 'Dictionary type cannot be deleted' })
  @Roles(Role.ADMIN)
  @HttpCode(204)
  @Delete(':id')
  deleteType(@Param('id') id: string): Promise<void> {
    return this.dictionaryTypeService.deleteType(id);
  }
}
