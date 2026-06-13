import { ApiProperty } from '@nestjs/swagger';

export class UploadSettingsResponseDto {
  @ApiProperty()
  maxSizeMb!: number;

  @ApiProperty({ type: [String] })
  allowedMimeTypes!: string[];

  @ApiProperty()
  environmentMaxSizeMb!: number;

  @ApiProperty({ type: [String] })
  environmentAllowedMimeTypes!: string[];

  @ApiProperty({ enum: ['local'] })
  storageDriver!: 'local';
}
