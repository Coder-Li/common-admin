import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';

describe('PositionController', () => {
  type ControllerMethod = (...args: unknown[]) => unknown;

  function controllerMethod(name: keyof PositionController): ControllerMethod {
    const descriptor = Object.getOwnPropertyDescriptor(
      PositionController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as ControllerMethod;
  }

  function getPermissionsMetadata(method: keyof PositionController): string[] {
    const metadata = Reflect.getMetadata(
      PERMISSIONS_KEY,
      controllerMethod(method),
    ) as unknown;

    return metadata as string[];
  }

  function getRoutePaths(): string[] {
    return Object.getOwnPropertyNames(PositionController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const path = Reflect.getMetadata(
          PATH_METADATA,
          controllerMethod(name as keyof PositionController),
        ) as unknown;

        return path;
      })
      .filter((path): path is string => typeof path === 'string');
  }

  function getSwaggerResponses(
    method: keyof PositionController,
  ): Record<string, unknown> {
    const metadata = Reflect.getMetadata(
      'swagger/apiResponse',
      controllerMethod(method),
    ) as unknown;

    return metadata as Record<string, unknown>;
  }

  const responseDto = {
    id: 'position-1',
    code: 'platform-engineer',
    name: 'Platform Engineer',
    status: 'ACTIVE',
    sortOrder: 0,
    description: null,
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
  };
  const optionDto = [
    {
      id: 'position-1',
      code: 'platform-engineer',
      name: 'Platform Engineer',
      status: 'ACTIVE',
    },
  ];
  const listDto = {
    items: [responseDto],
    total: 1,
    page: 1,
    pageSize: 20,
  };
  const user = {
    sub: 'actor-1',
    sid: 'session-1',
    email: 'actor@example.com',
    username: 'Actor',
  };
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  };
  const auditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'Actor',
  };
  const auditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
  const auditMetadata = {
    requestId: 'req_12345678',
  };

  const createService = () => ({
    listPositions: jest.fn().mockResolvedValue(listDto),
    getPositionOptions: jest.fn().mockResolvedValue(optionDto),
    findById: jest.fn().mockResolvedValue(responseDto),
    createPosition: jest.fn().mockResolvedValue(responseDto),
    updatePosition: jest.fn().mockResolvedValue(responseDto),
    deletePosition: jest.fn().mockResolvedValue(undefined),
  });

  it.each([
    ['listPositions', ['position.read']],
    ['getPositionOptions', ['position.read']],
    ['getPosition', ['position.read']],
    ['createPosition', ['position.create']],
    ['updatePosition', ['position.update']],
    ['deletePosition', ['position.delete']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(getPermissionsMetadata(method)).toEqual(permissions);
  });

  it('declares the options route before the id route', () => {
    const routePaths = getRoutePaths();

    expect(routePaths.indexOf('options')).toBeLessThan(
      routePaths.indexOf(':id'),
    );
  });

  it('documents delete dependency failures as bad requests', () => {
    const responses = getSwaggerResponses('deletePosition');

    expect(responses).toHaveProperty('400');
    expect(responses).not.toHaveProperty('409');
  });

  it('GET /positions delegates to listPositions', async () => {
    const service = createService();
    const controller = new PositionController(
      service as unknown as PositionService,
    );
    const query = { page: 1, pageSize: 20, search: 'platform' };

    await expect(controller.listPositions(query)).resolves.toBe(listDto);

    expect(service.listPositions).toHaveBeenCalledWith(query);
  });

  it('GET /positions/options delegates to getPositionOptions', async () => {
    const service = createService();
    const controller = new PositionController(
      service as unknown as PositionService,
    );
    const query = { includeIds: 'position-2' };

    await expect(controller.getPositionOptions(query)).resolves.toBe(optionDto);

    expect(service.getPositionOptions).toHaveBeenCalledWith(query);
  });

  it('GET /positions/:id delegates to findById', async () => {
    const service = createService();
    const controller = new PositionController(
      service as unknown as PositionService,
    );

    await expect(controller.getPosition('position-1')).resolves.toBe(
      responseDto,
    );

    expect(service.findById).toHaveBeenCalledWith('position-1');
  });

  it('POST /positions delegates to createPosition with audit metadata', async () => {
    const service = createService();
    const controller = new PositionController(
      service as unknown as PositionService,
    );
    const body = { code: 'platform-engineer', name: 'Platform Engineer' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.createPosition(body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.createPosition).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('PATCH /positions/:id delegates to updatePosition with audit metadata', async () => {
    const service = createService();
    const controller = new PositionController(
      service as unknown as PositionService,
    );
    const body = { name: 'Senior Platform Engineer' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.updatePosition('position-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.updatePosition).toHaveBeenCalledWith(
      'position-1',
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('DELETE /positions/:id delegates to deletePosition and returns 204', async () => {
    const service = createService();
    const controller = new PositionController(
      service as unknown as PositionService,
    );
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.deletePosition('position-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.deletePosition).toHaveBeenCalledWith(
      'position-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        controllerMethod('deletePosition'),
      ),
    ).toBe(204);
  });
});
