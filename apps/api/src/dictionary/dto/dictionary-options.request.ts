import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, Matches } from 'class-validator';
import {
  DICTIONARY_CODE_PATTERN,
  transformDictionaryTypes,
} from './dictionary-validation';

export class DictionaryOptionsQueryDto {
  @ApiProperty({ example: 'user_role,common_status' })
  @Transform(transformDictionaryTypes)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(30)
  @Matches(DICTIONARY_CODE_PATTERN, { each: true })
  types!: string[];
}
