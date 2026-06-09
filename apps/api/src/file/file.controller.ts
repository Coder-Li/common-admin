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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../user/current-user.decorator';
import { Role } from '../user/role.enum';
import type { JwtUserPayload } from '../user/user.types';
import {
  FileListQueryDto,
  UpdateFileDto,
  UploadFileMetadataDto,
} from './dto/file.request';
import { FileListResponseDto, FileResponseDto } from './dto/file.response';
import { FileService } from './file.service';

@ApiTags('Files')
@ApiBearerAuth('access-token')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @ApiOkResponse({ type: FileListResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @Roles(Role.ADMIN)
  @Get()
  listFiles(@Query() query: FileListQueryDto): Promise<FileListResponseDto> {
    return this.fileService.listFiles(query);
  }

  @ApiCreatedResponse({ type: FileResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileMetadataDto })
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: defaultUploadLimitBytes() },
    }),
  )
  @Post()
  uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadFileMetadataDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<FileResponseDto> {
    return this.fileService.createFile(file, body, user.sub);
  }

  @ApiOkResponse({ description: 'File download stream' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @Roles(Role.ADMIN)
  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { file, stream, size, downloadName } =
      await this.fileService.getDownload(id);

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', size.toString());
    response.setHeader('Content-Disposition', contentDisposition(downloadName));

    return new StreamableFile(stream);
  }

  @ApiOkResponse({ type: FileResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @Roles(Role.ADMIN)
  @Get(':id')
  getFile(@Param('id') id: string): Promise<FileResponseDto> {
    return this.fileService.findById(id);
  }

  @ApiOkResponse({ type: FileResponseDto })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @Roles(Role.ADMIN)
  @Patch(':id')
  updateFile(
    @Param('id') id: string,
    @Body() body: UpdateFileDto,
  ): Promise<FileResponseDto> {
    return this.fileService.updateFile(id, body);
  }

  @ApiNoContentResponse({ description: 'File deleted' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @Roles(Role.ADMIN)
  @HttpCode(204)
  @Delete(':id')
  deleteFile(@Param('id') id: string): Promise<void> {
    return this.fileService.deleteFile(id);
  }
}

function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(/['()]/g, escapeHeaderChar);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function escapeHeaderChar(value: string): string {
  return `%${value.charCodeAt(0).toString(16).toUpperCase()}`;
}

function defaultUploadLimitBytes(): number {
  const maxSizeMb = Number(process.env.FILE_MAX_SIZE_MB || 20);

  return maxSizeMb * 1024 * 1024;
}
