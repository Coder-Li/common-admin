import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { AppEnv } from '../../config/env.config';
import { LocalStorageService } from './local-storage.service';

jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn(),
}));

describe('LocalStorageService', () => {
  let storageRoot: string;
  let service: LocalStorageService;

  const randomUUIDMock = jest.mocked(randomUUID);

  beforeEach(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'common-admin-files-'));
    randomUUIDMock.mockReturnValue('11111111-1111-4111-8111-111111111111');

    const config = {
      getOrThrow: jest.fn((key: keyof AppEnv) => {
        if (key === 'LOCAL_STORAGE_ROOT') {
          return storageRoot;
        }

        throw new Error(`Unexpected config key: ${String(key)}`);
      }),
    } as unknown as ConfigService<AppEnv, true>;

    service = new LocalStorageService(config);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('save() writes a buffer under YYYY/MM/<uuid>.<extension>', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-09T04:05:06.000Z'));

    const stored = await service.save({
      buffer: Buffer.from('hello'),
      originalName: 'hello.txt',
      mimeType: 'text/plain',
      extension: 'txt',
    });

    expect(stored).toEqual({
      bucket: null,
      objectKey: '2026/06/11111111-1111-4111-8111-111111111111.txt',
    });
    await expect(
      readFile(path.join(storageRoot, stored.objectKey), 'utf8'),
    ).resolves.toBe('hello');

    jest.useRealTimers();
  });

  it('save() omits the trailing dot when extension is null', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-09T04:05:06.000Z'));

    const stored = await service.save({
      buffer: Buffer.from('hello'),
      originalName: 'hello',
      mimeType: 'application/octet-stream',
      extension: null,
    });

    expect(stored.objectKey).toBe(
      '2026/06/11111111-1111-4111-8111-111111111111',
    );
    await expect(
      readFile(path.join(storageRoot, stored.objectKey), 'utf8'),
    ).resolves.toBe('hello');

    jest.useRealTimers();
  });

  it('read() returns a stream and file size', async () => {
    const objectKey = '2026/06/read-me.txt';
    await mkdir(path.dirname(path.join(storageRoot, objectKey)), {
      recursive: true,
    });
    await writeFile(path.join(storageRoot, objectKey), 'hello');

    const result = await service.read({ bucket: null, objectKey });

    expect(result.size).toBe(5);
    expect(result.stream).toBeInstanceOf(Readable);
  });

  it('delete() succeeds when the file exists', async () => {
    const objectKey = '2026/06/delete-me.txt';
    const filePath = path.join(storageRoot, objectKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, 'hello');

    await expect(
      service.delete({ bucket: null, objectKey }),
    ).resolves.toBeUndefined();
    await expect(readFile(filePath)).rejects.toThrow();
  });

  it('delete() is idempotent when the file is already missing', async () => {
    await expect(
      service.delete({ bucket: null, objectKey: '2026/06/missing.txt' }),
    ).resolves.toBeUndefined();
  });

  it('rejects path traversal object keys', async () => {
    await expect(
      service.read({ bucket: null, objectKey: '../secret.txt' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.delete({ bucket: null, objectKey: '../secret.txt' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException for missing reads', async () => {
    await expect(
      service.read({ bucket: null, objectKey: '2026/06/missing.txt' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
