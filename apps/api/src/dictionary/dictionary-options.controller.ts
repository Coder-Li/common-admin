import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DictionaryOptionsService } from './dictionary-options.service';
import { DictionaryOptionsQueryDto } from './dto/dictionary-options.request';
import {
  DictionaryOptionsMapResponseDto,
  DictionaryOptionsResponseDto,
} from './dto/dictionary-options.response';
import { DICTIONARY_CODE_PATTERN } from './dto/dictionary-validation';

@ApiTags('Dictionaries')
@ApiBearerAuth('access-token')
@Controller('dictionaries')
export class DictionaryOptionsController {
  constructor(
    private readonly dictionaryOptionsService: DictionaryOptionsService,
  ) {}

  @ApiOkResponse({ type: DictionaryOptionsMapResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid dictionary type query' })
  @Get('options')
  getOptionsMap(
    @Query() query: DictionaryOptionsQueryDto,
  ): Promise<DictionaryOptionsMapResponseDto> {
    return this.dictionaryOptionsService.getOptionsMap(query.types);
  }

  @ApiOkResponse({ type: DictionaryOptionsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid dictionary type code' })
  @Get(':typeCode/options')
  getOptions(
    @Param('typeCode') typeCode: string,
  ): Promise<DictionaryOptionsResponseDto> {
    if (!DICTIONARY_CODE_PATTERN.test(typeCode)) {
      throw new BadRequestException('Invalid dictionary type code');
    }

    return this.dictionaryOptionsService.getOptions(typeCode);
  }
}
