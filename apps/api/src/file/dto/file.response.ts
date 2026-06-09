import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileStorageDriver, FileVisibility } from '@prisma/client';
import { ListResponse } from '../../common/dto/list-response.dto';

export class FileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiPropertyOptional({ nullable: true })
  extension!: string | null;

  @ApiProperty({ type: String })
  size!: string;

  @ApiProperty({ enum: FileStorageDriver })
  storageDriver!: FileStorageDriver;

  @ApiProperty({ enum: FileVisibility })
  visibility!: FileVisibility;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  uploadedById!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class FileListResponseDto implements ListResponse<FileResponseDto> {
  @ApiProperty({ type: [FileResponseDto] })
  items!: FileResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
