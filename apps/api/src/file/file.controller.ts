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
  Req,
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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import {
  buildAuditActor,
  getAuditRequestMeta,
} from '../audit-log/audit-log-request-meta';
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../user/current-user.decorator';
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
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiOperation({ operationId: 'listFiles' })
  @Permissions('file.read')
  @Get()
  listFiles(@Query() query: FileListQueryDto): Promise<FileListResponseDto> {
    return this.fileService.listFiles(query);
  }

  @ApiCreatedResponse({ type: FileResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileMetadataDto })
  @ApiOperation({ operationId: 'uploadFile' })
  @Permissions('file.upload')
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
    @Req() request: Request,
  ): Promise<FileResponseDto> {
    return this.fileService.createFile(
      file,
      body,
      user.sub,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }

  @ApiOkResponse({ description: 'File download stream' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiOperation({ operationId: 'downloadFile' })
  @Permissions('file.download')
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
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiOperation({ operationId: 'getFile' })
  @Permissions('file.read')
  @Get(':id')
  getFile(@Param('id') id: string): Promise<FileResponseDto> {
    return this.fileService.findById(id);
  }

  @ApiOkResponse({ type: FileResponseDto })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiOperation({ operationId: 'updateFile' })
  @Permissions('file.update')
  @Patch(':id')
  updateFile(
    @Param('id') id: string,
    @Body() body: UpdateFileDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<FileResponseDto> {
    return this.fileService.updateFile(
      id,
      body,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }

  @ApiNoContentResponse({ description: 'File deleted' })
  @ApiForbiddenResponse({ description: 'Permission required' })
  @ApiNotFoundResponse({ description: 'File not found' })
  @ApiOperation({ operationId: 'deleteFile' })
  @Permissions('file.delete')
  @HttpCode(204)
  @Delete(':id')
  deleteFile(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
    @Req() request: Request,
  ): Promise<void> {
    return this.fileService.deleteFile(
      id,
      buildAuditActor(user),
      getAuditRequestMeta(request),
    );
  }
}

function contentDisposition(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()]/g,
    escapeHeaderChar,
  );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function escapeHeaderChar(value: string): string {
  return `%${value.charCodeAt(0).toString(16).toUpperCase()}`;
}

function defaultUploadLimitBytes(): number {
  const maxSizeMb = Number(process.env.FILE_MAX_SIZE_MB || 20);

  return maxSizeMb * 1024 * 1024;
}
