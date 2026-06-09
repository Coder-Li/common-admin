import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { FileStorageDriver, FileVisibility } from '@prisma/client';
import { Readable } from 'node:stream';
import type { AppEnv } from '../config/env.config';
import {
  FileListQueryDto,
  UpdateFileDto,
  validateMetadataShape,
} from './dto/file.request';
import { toFileResponse } from './file.mapper';
import { FileService } from './file.service';
import type { StorageService } from './storage/storage.types';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

function transformQuery<T>(metatype: new () => T, query: Record<string, unknown>) {
  return validationPipe.transform(query, {
    type: 'query',
    metatype,
  }) as Promise<T>;
}

function transformBody<T>(metatype: new () => T, body: Record<string, unknown>) {
  return validationPipe.transform(body, {
    type: 'body',
    metatype,
  }) as Promise<T>;
}

describe('FileListQueryDto', () => {
  it('defaults list query values and accepts mimeType and storageDriver filters', async () => {
    await expect(
      transformQuery(FileListQueryDto, {
        mimeType: 'image/png',
        storageDriver: FileStorageDriver.LOCAL,
      }),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      mimeType: 'image/png',
      storageDriver: FileStorageDriver.LOCAL,
    });
  });

  it('rejects invalid sort fields', async () => {
    await expect(
      transformQuery(FileListQueryDto, { sort: 'objectKey:asc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid storage drivers', async () => {
    await expect(
      transformQuery(FileListQueryDto, { storageDriver: 'S3' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateFileDto', () => {
  it('rejects an empty body', async () => {
    await expect(transformBody(UpdateFileDto, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an empty displayName', async () => {
    await expect(
      transformBody(UpdateFileDto, { displayName: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('metadata validation helpers', () => {
  it.each([
    ['arrays', []],
    ['scalars', 'hello'],
    ['objects deeper than 5 levels', { a: { b: { c: { d: { e: { f: true } } } } } }],
    ['serialized JSON over 16 KB', { value: 'x'.repeat(16 * 1024) }],
  ])('rejects %s', (_label, value) => {
    expect(() => validateMetadataShape(value)).toThrow(BadRequestException);
  });
});

describe('file mapper', () => {
  it('serializes size as a string and omits internal storage fields', () => {
    const response = toFileResponse({
      id: 'file-1',
      originalName: 'report.pdf',
      displayName: 'Report',
      mimeType: 'application/pdf',
      extension: 'pdf',
      size: 12345n,
      storageDriver: FileStorageDriver.LOCAL,
      bucket: null,
      objectKey: '2026/06/object.pdf',
      checksum: 'abc123',
      visibility: FileVisibility.PRIVATE,
      description: null,
      metadata: { source: 'test' },
      uploadedById: 'user-1',
      createdAt: new Date('2026-06-09T01:02:03.000Z'),
      updatedAt: new Date('2026-06-09T04:05:06.000Z'),
      deletedAt: null,
    });

    expect(response).toEqual({
      id: 'file-1',
      originalName: 'report.pdf',
      displayName: 'Report',
      mimeType: 'application/pdf',
      extension: 'pdf',
      size: '12345',
      storageDriver: FileStorageDriver.LOCAL,
      visibility: FileVisibility.PRIVATE,
      description: null,
      metadata: { source: 'test' },
      uploadedById: 'user-1',
      createdAt: '2026-06-09T01:02:03.000Z',
      updatedAt: '2026-06-09T04:05:06.000Z',
    });
    expect(response).not.toHaveProperty('bucket');
    expect(response).not.toHaveProperty('objectKey');
    expect(response).not.toHaveProperty('checksum');
  });
});

describe('FileService', () => {
  const makeFile = (overrides: Record<string, unknown> = {}) => ({
    id: 'file-1',
    originalName: 'report.pdf',
    displayName: 'Report',
    mimeType: 'application/pdf',
    extension: 'pdf',
    size: 5n,
    storageDriver: FileStorageDriver.LOCAL,
    bucket: null,
    objectKey: '2026/06/object.pdf',
    checksum: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    visibility: FileVisibility.PRIVATE,
    description: null,
    metadata: null,
    uploadedById: 'user-1',
    createdAt: new Date('2026-06-09T01:02:03.000Z'),
    updatedAt: new Date('2026-06-09T04:05:06.000Z'),
    deletedAt: null,
    ...overrides,
  });

  const makeUpload = (overrides: Partial<Express.Multer.File> = {}) =>
    ({
      fieldname: 'file',
      originalname: 'report.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 5,
      buffer: Buffer.from('hello'),
      ...overrides,
    }) as Express.Multer.File;

  const createPrismaMock = () => ({
    managedFile: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  });

  const createStorageMock = (): jest.Mocked<StorageService> => ({
    driver: FileStorageDriver.LOCAL,
    save: jest.fn(),
    read: jest.fn(),
    delete: jest.fn(),
  });

  const createConfigMock = (overrides: Partial<AppEnv> = {}) => {
    const values = {
      FILE_ALLOWED_MIME_TYPES: 'application/pdf,text/plain,image/png',
      ...overrides,
    };

    return {
      getOrThrow: jest.fn((key: keyof AppEnv) => values[key]),
    } as unknown as ConfigService<AppEnv, true>;
  };

  const createService = (configOverrides: Partial<AppEnv> = {}) => {
    const prisma = createPrismaMock();
    const storage = createStorageMock();
    const config = createConfigMock(configOverrides);
    const service = new FileService(prisma as never, config, storage);

    storage.save.mockResolvedValue({
      bucket: null,
      objectKey: '2026/06/object.pdf',
    });
    storage.read.mockResolvedValue({
      stream: Readable.from(['hello']),
      size: 5,
    });
    storage.delete.mockResolvedValue(undefined);

    return { config, prisma, service, storage };
  };

  function firstMockArg<TArg>(mock: { mock: { calls: unknown[][] } }): TArg {
    const firstCall = mock.mock.calls[0];

    if (!firstCall) {
      throw new Error('Expected mock to have been called');
    }

    return firstCall[0] as TArg;
  }

  describe('listFiles', () => {
    it('filters deleted records, applies search, sorts by allowed fields, and returns a list response', async () => {
      const { prisma, service } = createService();
      prisma.managedFile.findMany.mockResolvedValue([makeFile()]);
      prisma.managedFile.count.mockResolvedValue(1);

      await expect(
        service.listFiles({
          page: 2,
          pageSize: 10,
          sort: 'displayName:asc',
          search: 'report',
        }),
      ).resolves.toMatchObject({
        items: [{ id: 'file-1', size: '5' }],
        total: 1,
        page: 2,
        pageSize: 10,
      });

      expect(prisma.managedFile.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        orderBy: { displayName: 'asc' },
        where: {
          deletedAt: null,
          OR: [
            { originalName: { contains: 'report', mode: 'insensitive' } },
            { displayName: { contains: 'report', mode: 'insensitive' } },
            { description: { contains: 'report', mode: 'insensitive' } },
          ],
        },
      });
      expect(prisma.managedFile.count).toHaveBeenCalledWith({
        where: firstMockArg<{ where: unknown }>(prisma.managedFile.findMany)
          .where,
      });
    });

    it('passes mimeType and storageDriver filters into the Prisma where object', async () => {
      const { prisma, service } = createService();
      prisma.managedFile.findMany.mockResolvedValue([]);
      prisma.managedFile.count.mockResolvedValue(0);

      await service.listFiles({
        page: 1,
        pageSize: 20,
        mimeType: 'image/png',
        storageDriver: FileStorageDriver.LOCAL,
      });

      expect(prisma.managedFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            mimeType: 'image/png',
            storageDriver: FileStorageDriver.LOCAL,
          },
        }),
      );
    });

    it('throws BadRequestException for invalid sort values', async () => {
      const { service } = createService();

      await expect(
        service.listFiles({ page: 1, pageSize: 20, sort: 'objectKey:asc' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findById', () => {
    it('returns a non-deleted file', async () => {
      const { prisma, service } = createService();
      prisma.managedFile.findFirst.mockResolvedValue(makeFile());

      await expect(service.findById('file-1')).resolves.toMatchObject({
        id: 'file-1',
        size: '5',
      });
      expect(prisma.managedFile.findFirst).toHaveBeenCalledWith({
        where: { id: 'file-1', deletedAt: null },
      });
    });

    it('throws NotFoundException for missing or soft-deleted files', async () => {
      const { prisma, service } = createService();
      prisma.managedFile.findFirst.mockResolvedValue(null);

      await expect(service.findById('file-1')).rejects.toThrow('File not found');
    });
  });

  describe('createFile', () => {
    it('rejects missing uploads', async () => {
      const { service } = createService();

      await expect(service.createFile(undefined, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects MIME types outside FILE_ALLOWED_MIME_TYPES', async () => {
      const { service } = createService();

      await expect(
        service.createFile(makeUpload({ mimetype: 'application/zip' }), {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('normalizes original name and falls back to uploaded-file', async () => {
      const { prisma, service } = createService({
        FILE_ALLOWED_MIME_TYPES: 'text/plain',
      });
      prisma.managedFile.create.mockResolvedValue(
        makeFile({
          originalName: 'uploaded-file',
          displayName: 'uploaded-file',
          mimeType: 'text/plain',
          extension: 'txt',
        }),
      );

      await service.createFile(
        makeUpload({
          originalname: '   ',
          mimetype: 'text/plain',
          size: 5,
        }),
        {},
      );

      expect(prisma.managedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalName: 'uploaded-file',
            displayName: 'uploaded-file',
          }),
        }),
      );
    });

    it('derives extension without a leading dot', async () => {
      const { prisma, storage, service } = createService();
      prisma.managedFile.create.mockResolvedValue(makeFile());

      await service.createFile(makeUpload({ originalname: 'report.pdf' }), {});

      expect(storage.save).toHaveBeenCalledWith(
        expect.objectContaining({ extension: 'pdf' }),
      );
    });

    it('stores content and persists metadata with a SHA-256 checksum', async () => {
      const { prisma, storage, service } = createService();
      prisma.managedFile.create.mockResolvedValue(makeFile());

      await service.createFile(
        makeUpload({ originalname: '../report.pdf' }),
        {
          displayName: ' Quarterly Report ',
          description: ' For admins ',
          metadata: { source: 'test' },
        },
        'user-1',
      );

      expect(storage.save).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: Buffer.from('hello'),
          originalName: 'report.pdf',
          mimeType: 'application/pdf',
        }),
      );
      expect(prisma.managedFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalName: 'report.pdf',
          displayName: 'Quarterly Report',
          description: 'For admins',
          metadata: { source: 'test' },
          checksum:
            '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
          uploadedById: 'user-1',
          bucket: null,
          objectKey: '2026/06/object.pdf',
        }),
      });
    });

    it('deletes the stored object if Prisma create fails', async () => {
      const { prisma, storage, service } = createService();
      const error = new Error('db failed');
      prisma.managedFile.create.mockRejectedValue(error);

      await expect(service.createFile(makeUpload(), {})).rejects.toThrow(error);
      expect(storage.delete).toHaveBeenCalledWith({
        bucket: null,
        objectKey: '2026/06/object.pdf',
        checksum:
          '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      });
    });
  });

  describe('updateFile', () => {
    it('trims fields and rejects empty updates', async () => {
      const { prisma, service } = createService();
      prisma.managedFile.update.mockResolvedValue(
        makeFile({ displayName: 'Updated', description: null }),
      );

      await expect(service.updateFile('file-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      await service.updateFile('file-1', {
        displayName: ' Updated ',
        description: null,
      });

      expect(prisma.managedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-1', deletedAt: null },
        data: {
          displayName: 'Updated',
          description: null,
        },
      });
    });
  });

  describe('deleteFile', () => {
    it('calls storage delete before setting deletedAt', async () => {
      const { prisma, storage, service } = createService();
      prisma.managedFile.findFirst.mockResolvedValue(makeFile());
      prisma.managedFile.update.mockResolvedValue(makeFile({ deletedAt: new Date() }));

      await service.deleteFile('file-1');

      expect(storage.delete).toHaveBeenCalledWith({
        bucket: null,
        objectKey: '2026/06/object.pdf',
        checksum:
          '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      });
      expect(storage.delete.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.managedFile.update.mock.invocationCallOrder[0],
      );
      expect(prisma.managedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('does not set deletedAt if storage delete throws', async () => {
      const { prisma, storage, service } = createService();
      prisma.managedFile.findFirst.mockResolvedValue(makeFile());
      storage.delete.mockRejectedValue(new Error('storage failed'));

      await expect(service.deleteFile('file-1')).rejects.toThrow(
        'storage failed',
      );
      expect(prisma.managedFile.update).not.toHaveBeenCalled();
    });
  });

  describe('getDownload', () => {
    it('returns storage read result and file metadata', async () => {
      const { prisma, service } = createService();
      prisma.managedFile.findFirst.mockResolvedValue(
        makeFile({ displayName: 'Quarterly Report' }),
      );

      await expect(service.getDownload('file-1')).resolves.toMatchObject({
        file: expect.objectContaining({ id: 'file-1' }),
        size: 5,
        downloadName: 'Quarterly Report.pdf',
      });
    });
  });
});
