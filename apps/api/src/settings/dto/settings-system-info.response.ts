import { ApiProperty } from '@nestjs/swagger';

export class SystemInfoResponseDto {
  @ApiProperty()
  serviceName!: string;

  @ApiProperty()
  appEnv!: string;

  @ApiProperty()
  nodeEnv!: string;

  @ApiProperty()
  logLevel!: string;

  @ApiProperty({ enum: ['local'] })
  storageDriver!: 'local';

  @ApiProperty()
  uploadMaxSizeMb!: number;

  @ApiProperty({ type: [String] })
  uploadAllowedMimeTypes!: string[];
}
