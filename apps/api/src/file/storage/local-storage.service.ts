import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStorageDriver } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppEnv } from '../../config/env.config';
import type {
  SaveFileInput,
  StorageReadResult,
  StorageService,
  StoredObject,
} from './storage.types';

@Injectable()
export class LocalStorageService implements StorageService {
  readonly driver = FileStorageDriver.LOCAL;

  private readonly root: string;

  constructor(config: ConfigService<AppEnv, true>) {
    const configuredRoot = config.getOrThrow<string>('LOCAL_STORAGE_ROOT');
    this.root = path.isAbsolute(configuredRoot)
      ? path.resolve(configuredRoot)
      : path.resolve(process.cwd(), configuredRoot);
  }

  async save(input: SaveFileInput): Promise<StoredObject> {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = input.extension
      ? `${randomUUID()}.${input.extension}`
      : randomUUID();
    const objectKey = path.posix.join(year, month, fileName);
    const filePath = this.resolveObjectPath(objectKey);

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.buffer);

    return {
      bucket: null,
      objectKey,
    };
  }

  async read(object: StoredObject): Promise<StorageReadResult> {
    const filePath = this.resolveObjectPath(object.objectKey);

    try {
      const fileStat = await stat(filePath);

      return {
        stream: createReadStream(filePath),
        size: fileStat.size,
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new NotFoundException('File object not found');
      }

      throw error;
    }
  }

  async delete(object: StoredObject): Promise<void> {
    const filePath = this.resolveObjectPath(object.objectKey);

    try {
      await unlink(filePath);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }

      throw error;
    }
  }

  private resolveObjectPath(objectKey: string): string {
    if (!objectKey || path.isAbsolute(objectKey)) {
      throw new BadRequestException('Invalid file object key');
    }

    const normalizedKey = objectKey.split('/').join(path.sep);
    const resolvedPath = path.resolve(this.root, normalizedKey);
    const relativePath = path.relative(this.root, resolvedPath);

    if (
      relativePath === '' ||
      relativePath.startsWith('..') ||
      path.isAbsolute(relativePath)
    ) {
      throw new BadRequestException('Invalid file object key');
    }

    return resolvedPath;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
