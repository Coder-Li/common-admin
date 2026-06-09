import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { FileStorageDriver, FileVisibility } from '@prisma/client';
import {
  FileListQueryDto,
  UpdateFileDto,
  validateMetadataShape,
} from './dto/file.request';
import { toFileResponse } from './file.mapper';

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
