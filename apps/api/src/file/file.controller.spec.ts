import { BadRequestException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { FileStorageDriver, FileVisibility } from '@prisma/client';
import { Readable } from 'node:stream';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
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
  const user = {
    sub: 'actor-1',
    email: 'actor@example.com',
    username: 'actor',
  };
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  };
  const auditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'actor',
  };
  const auditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
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

  it.each([
    ['listFiles', ['file.read']],
    ['getFile', ['file.read']],
    ['uploadFile', ['file.upload']],
    ['downloadFile', ['file.download']],
    ['updateFile', ['file.update']],
    ['deleteFile', ['file.delete']],
  ] as const)('requires %s permission metadata', (method, permissions) => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod(method)),
    ).toEqual(permissions);
  });

  it('GET /files calls FileService.listFiles() with FileListQueryDto and no audit metadata', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const query = new FileListQueryDto();

    await expect(controller.listFiles(query)).resolves.toMatchObject({
      items: [responseDto],
    });
    expect(service.listFiles).toHaveBeenCalledWith(query);
    expect(service.createFile).not.toHaveBeenCalled();
    expect(service.updateFile).not.toHaveBeenCalled();
    expect(service.deleteFile).not.toHaveBeenCalled();
  });

  it('GET /files/:id calls FileService.findById() without audit metadata', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);

    await expect(controller.getFile('file-1')).resolves.toBe(responseDto);
    expect(service.findById).toHaveBeenCalledWith('file-1');
    expect(service.createFile).not.toHaveBeenCalled();
    expect(service.updateFile).not.toHaveBeenCalled();
    expect(service.deleteFile).not.toHaveBeenCalled();
  });

  it('upload calls FileService.createFile() with the multipart file, body DTO, current user id, actor, and request metadata', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const file = { originalname: 'report.pdf' } as Express.Multer.File;
    const body = { displayName: 'Report' };

    await expect(
      controller.uploadFile(file, body, user as never, request as never),
    ).resolves.toBe(responseDto);
    expect(service.createFile).toHaveBeenCalledWith(
      file,
      body,
      'actor-1',
      auditActor,
      auditRequestMeta,
    );
  });

  it('PATCH /files/:id calls FileService.updateFile() with actor and request metadata', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const body = new UpdateFileDto();
    body.displayName = 'Updated';

    await expect(
      controller.updateFile('file-1', body, user as never, request as never),
    ).resolves.toBe(responseDto);
    expect(service.updateFile).toHaveBeenCalledWith(
      'file-1',
      body,
      auditActor,
      auditRequestMeta,
    );
  });

  it('DELETE /files/:id calls FileService.deleteFile() with actor and request metadata', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);

    await expect(
      controller.deleteFile('file-1', user as never, request as never),
    ).resolves.toBeUndefined();
    expect(service.deleteFile).toHaveBeenCalledWith(
      'file-1',
      auditActor,
      auditRequestMeta,
    );
  });

  it('propagates upload BadRequestException from the service', async () => {
    const service = createService();
    const controller = new FileController(service as unknown as FileService);
    const error = new BadRequestException('File upload is required');
    service.createFile.mockRejectedValue(error);

    await expect(
      controller.uploadFile(undefined, {}, user as never, request as never),
    ).rejects.toBe(error);
  });

  it('download sets Content-Type, Content-Length, and Content-Disposition without audit metadata', async () => {
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
    expect(service.getDownload).toHaveBeenCalledWith('file-1');
    expect(service.createFile).not.toHaveBeenCalled();
    expect(service.updateFile).not.toHaveBeenCalled();
    expect(service.deleteFile).not.toHaveBeenCalled();
  });

  it('delete returns 204 through controller metadata', () => {
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, controllerMethod('deleteFile')),
    ).toBe(204);
  });
});
