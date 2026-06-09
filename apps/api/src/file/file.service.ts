import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileVisibility, ManagedFile, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createListResponse } from '../common/dto/list-response.dto';
import type { AppEnv } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';
import {
  FileListQueryDto,
  UpdateFileDto,
  UploadFileMetadataDto,
  hasUpdateFileFields,
} from './dto/file.request';
import { FileListResponseDto, FileResponseDto } from './dto/file.response';
import { toFileResponse } from './file.mapper';
import { FILE_STORAGE } from './storage/storage.constants';
import type { StorageService, StoredObject } from './storage/storage.types';

const FILE_SORT_FIELDS = new Set([
  'displayName',
  'mimeType',
  'size',
  'storageDriver',
  'createdAt',
  'updatedAt',
]);

const MIME_EXTENSION_MAP = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
  ['text/plain', 'txt'],
]);

@Injectable()
export class FileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
    @Inject(FILE_STORAGE) private readonly storage: StorageService,
  ) {}

  async listFiles(query: FileListQueryDto): Promise<FileListResponseDto> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [files, total] = await Promise.all([
      this.prisma.managedFile.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
      }),
      this.prisma.managedFile.count({ where }),
    ]);

    return createListResponse(
      files.map((file) => toFileResponse(file)),
      total,
      page,
      pageSize,
    );
  }

  async findById(id: string): Promise<FileResponseDto> {
    const file = await this.findExistingFile(id);

    return toFileResponse(file);
  }

  async createFile(
    file: Express.Multer.File | undefined,
    metadataDto: UploadFileMetadataDto,
    uploadedById?: string,
  ): Promise<FileResponseDto> {
    if (!file) {
      throw new BadRequestException('File upload is required');
    }

    this.assertAllowedMimeType(file.mimetype);

    const originalName = normalizeOriginalName(file.originalname);
    const extension = deriveExtension(originalName, file.mimetype);
    const displayName = metadataDto.displayName?.trim() || originalName;
    const description =
      metadataDto.description === undefined
        ? undefined
        : metadataDto.description === null
          ? null
          : metadataDto.description.trim();
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    const stored = await this.storage.save({
      buffer: file.buffer,
      originalName,
      mimeType: file.mimetype,
      extension,
    });

    try {
      const persisted = await this.prisma.managedFile.create({
        data: {
          originalName,
          displayName,
          mimeType: file.mimetype,
          extension,
          size: BigInt(file.size),
          storageDriver: this.storage.driver,
          bucket: stored.bucket,
          objectKey: stored.objectKey,
          checksum,
          visibility: FileVisibility.PRIVATE,
          ...(description !== undefined ? { description } : {}),
          ...(metadataDto.metadata !== undefined
            ? { metadata: metadataDto.metadata as Prisma.InputJsonValue }
            : {}),
          ...(uploadedById ? { uploadedById } : {}),
        },
      });

      return toFileResponse(persisted);
    } catch (error) {
      await this.cleanupStoredObject({ ...stored, checksum });
      throw error;
    }
  }

  async updateFile(id: string, dto: UpdateFileDto): Promise<FileResponseDto> {
    if (!hasUpdateFileFields(dto)) {
      throw new BadRequestException('At least one file field must be provided');
    }

    const data: Prisma.ManagedFileUpdateInput = {
      ...(dto.displayName !== undefined
        ? { displayName: dto.displayName.trim() }
        : {}),
      ...(dto.description !== undefined
        ? {
            description:
              dto.description === null ? null : dto.description.trim(),
          }
        : {}),
      ...(dto.metadata !== undefined
        ? { metadata: dto.metadata as Prisma.InputJsonValue }
        : {}),
    };

    try {
      const file = await this.prisma.managedFile.update({
        where: { id, deletedAt: null },
        data,
      });

      return toFileResponse(file);
    } catch (error) {
      if (isPrismaNotFound(error)) {
        throw new NotFoundException('File not found');
      }

      throw error;
    }
  }

  async deleteFile(id: string): Promise<void> {
    const file = await this.findExistingFile(id);

    await this.storage.delete(toStoredObject(file));
    await this.prisma.managedFile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getDownload(id: string): Promise<{
    file: ManagedFile;
    stream: NodeJS.ReadableStream;
    size: number;
    downloadName: string;
  }> {
    const file = await this.findExistingFile(id);
    const { stream, size } = await this.storage.read(toStoredObject(file));

    return {
      file,
      stream,
      size,
      downloadName: buildDownloadName(file),
    };
  }

  parseSort(sort = 'createdAt:desc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !FILE_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid file sort');
    }

    return { field, direction };
  }

  buildWhere(query: FileListQueryDto): Prisma.ManagedFileWhereInput {
    const where: Prisma.ManagedFileWhereInput = { deletedAt: null };

    if (query.mimeType) {
      where.mimeType = query.mimeType;
    }

    if (query.storageDriver) {
      where.storageDriver = query.storageDriver;
    }

    if (query.search) {
      const search = {
        contains: query.search,
        mode: 'insensitive' as const,
      };

      where.OR = [
        { originalName: search },
        { displayName: search },
        { description: search },
      ];
    }

    return where;
  }

  private async findExistingFile(id: string): Promise<ManagedFile> {
    const file = await this.prisma.managedFile.findFirst({
      where: { id, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  private assertAllowedMimeType(mimeType: string): void {
    const allowedMimeTypes = this.config
      .getOrThrow<string>('FILE_ALLOWED_MIME_TYPES')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException('File type is not allowed');
    }
  }

  private async cleanupStoredObject(object: StoredObject): Promise<void> {
    try {
      await this.storage.delete(object);
    } catch {
      // Preserve the original persistence failure.
    }
  }
}

function normalizeOriginalName(originalName: string): string {
  const baseName = path.basename(originalName).trim();

  if (!baseName) {
    return 'uploaded-file';
  }

  return truncateFileName(baseName, 255);
}

function truncateFileName(fileName: string, maxLength: number): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  const extension = path.extname(fileName);

  if (!extension || extension.length >= maxLength) {
    return fileName.slice(0, maxLength);
  }

  return `${fileName.slice(0, maxLength - extension.length)}${extension}`;
}

function deriveExtension(
  originalName: string,
  mimeType: string,
): string | null {
  const extension = path.extname(originalName).replace(/^\./, '').trim();

  if (extension) {
    return extension.slice(0, 32);
  }

  return MIME_EXTENSION_MAP.get(mimeType) ?? null;
}

function toStoredObject(file: ManagedFile): StoredObject {
  return {
    bucket: file.bucket,
    objectKey: file.objectKey,
    ...(file.checksum ? { checksum: file.checksum } : {}),
  };
}

function buildDownloadName(file: ManagedFile): string {
  if (!file.extension || path.extname(file.displayName)) {
    return file.displayName;
  }

  return `${file.displayName}.${file.extension}`;
}

function isPrismaNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
