import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateUploadSettingsDto {
  @ApiProperty({ example: 20, minimum: 1 })
  @IsInt()
  @Min(1)
  maxSizeMb!: number;

  @ApiProperty({
    type: [String],
    example: ['image/png', 'application/pdf', 'text/plain'],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  allowedMimeTypes!: string[];
}
