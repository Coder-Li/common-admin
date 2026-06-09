import { BadRequestException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { FileStorageDriver, FileVisibility } from '@prisma/client';
import { Readable } from 'node:stream';
import { ROLES_KEY } from '../auth/roles.decorator';
import { Role } from '../user/role.enum';
import { FileListQueryDto, UpdateFileDto } from './dto/file.request';
import { FileController } from './file.controller';
import { FileService } from './file.service';

describe('FileController', () => {
  function controllerMethod(name: keyof FileController) {
    const descriptor = Object.getOwnPropertyDescriptor(
      FileController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as unknown;
  }

  const responseDto = {
    id: 'file-1',
    originalName: 'report.pdf',
    displayName: 'Report',
    mimeType: 'application/pdf',
    extension: 'pdf',
    size: '5',
    storageDriver: FileStorageDriver.LOCAL,
    visibility: FileVisibility.PRIVATE,
    description: null,
    metadata: null,
    uploadedById: 'user-1',
    createdAt: '2026-06-09T01:02:03.000Z',
    updatedAt: '2026-06-09T04:05:06.000Z',
  };

  const createService = () => {
    const listFiles = jest.fn().mockResolvedValue({
      items: [responseDto],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const findById = jest.fn().mockResolvedValue(responseDto);
    const createFile = jest.fn().mockResolvedValue(responseDto);
    const updateFile = jest.fn().mockResolvedValue(responseDto);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const getDownload = jest.fn().mockResolvedValue({
      file: {
        ...responseDto,
        size: 5n,
        bucket: null,
        objectKey: '2026/06/object.pdf',
        checksum: 'abc123',
        deletedAt: null,
        createdAt: new Date(responseDto.createdAt),
        updatedAt: new Date(responseDto.updatedAt),
      },
      stream: Readable.from(['hello']),
      size: 5,
      downloadName: 'Report.pdf',
    });

    return {
      listFiles,
      findById,
      createFile,
      updateFile,
      deleteFile,
      getDownload,
    };
  };

  it('requires admin role on all management routes', () => {
    for (const method of [
      'listFiles',
      'getFile',
      'uploadFile',
      'downloadFile',
      'updateFile',
      'deleteFile',
    ] satisfies Array<keyof FileController>) {
      expect(Reflect.getMetadata(ROLES_KEY, controllerMethod(method))).toEqual([
        Role.ADMIN,
      ]);
    }
  });

  it('GET /files calls FileService.listFiles() with FileListQueryDto', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const query = new FileListQueryDto();

    await expect(controller.listFiles(query)).resolves.toMatchObject({
      items: [responseDto],
    });
    expect(service.listFiles).toHaveBeenCalledWith(query);
  });

  it('GET /files/:id calls FileService.findById()', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);

    await expect(controller.getFile('file-1')).resolves.toBe(responseDto);
    expect(service.findById).toHaveBeenCalledWith('file-1');
  });

  it('upload calls FileService.createFile() with the multipart file, body DTO, and current user id', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const file = { originalname: 'report.pdf' } as Express.Multer.File;
    const body = { displayName: 'Report' };
    const user = { sub: 'user-1' };

    await expect(
      controller.uploadFile(file, body, user as never),
    ).resolves.toBe(responseDto);
    expect(service.createFile).toHaveBeenCalledWith(file, body, 'user-1');
  });

  it('PATCH /files/:id calls FileService.updateFile() with UpdateFileDto', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const body = new UpdateFileDto();
    body.displayName = 'Updated';

    await expect(controller.updateFile('file-1', body)).resolves.toBe(
      responseDto,
    );
    expect(service.updateFile).toHaveBeenCalledWith('file-1', body);
  });

  it('DELETE /files/:id calls FileService.deleteFile()', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);

    await expect(controller.deleteFile('file-1')).resolves.toBeUndefined();
    expect(service.deleteFile).toHaveBeenCalledWith('file-1');
  });

  it('propagates upload BadRequestException from the service', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const error = new BadRequestException('File upload is required');
    service.createFile.mockRejectedValue(error);

    await expect(
      controller.uploadFile(undefined, {}, { sub: 'user-1' } as never),
    ).rejects.toBe(error);
  });

  it('download sets Content-Type, Content-Length, and Content-Disposition', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const response = { setHeader: jest.fn() };

    const streamableFile = await controller.downloadFile(
      'file-1',
      response as never,
    );

    expect(streamableFile).toBeDefined();
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', '5');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('Report.pdf'),
    );
  });

  it('delete returns 204 through controller metadata', () => {
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, controllerMethod('deleteFile')),
    ).toBe(204);
  });
});
