import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

describe('DepartmentController', () => {
  function controllerMethod(name: keyof DepartmentController) {
    const descriptor = Object.getOwnPropertyDescriptor(
      DepartmentController.prototype,
      name,
    );

    if (!descriptor?.value) {
      throw new Error(`Expected ${String(name)} controller method`);
    }

    return descriptor.value as unknown;
  }

  function getPermissionsMetadata(method: keyof DepartmentController) {
    return Reflect.getMetadata(PERMISSIONS_KEY, controllerMethod(method));
  }

  function getRoutePaths() {
    return Object.getOwnPropertyNames(DepartmentController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) =>
        Reflect.getMetadata(
          PATH_METADATA,
          controllerMethod(name as keyof DepartmentController),
        ),
      )
      .filter((path): path is string => typeof path === 'string');
  }

  const responseDto = {
    id: 'dept-1',
    code: 'engineering',
    name: 'Engineering',
    parentId: null,
    parentName: null,
    status: 'ACTIVE',
    sortOrder: 0,
    description: null,
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
  };
  const treeDto = [
    {
      id: 'dept-1',
      code: 'engineering',
      name: 'Engineering',
      parentId: null,
      status: 'ACTIVE',
      sortOrder: 0,
      children: [],
    },
  ];
  const optionDto = [
    {
      id: 'dept-1',
      code: 'engineering',
      name: 'Engineering',
      parentId: null,
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
    listDepartments: jest.fn().mockResolvedValue(listDto),
    getDepartmentTree: jest.fn().mockResolvedValue(treeDto),
    getDepartmentOptions: jest.fn().mockResolvedValue(optionDto),
    findById: jest.fn().mockResolvedValue(responseDto),
    createDepartment: jest.fn().mockResolvedValue(responseDto),
    updateDepartment: jest.fn().mockResolvedValue(responseDto),
    deleteDepartment: jest.fn().mockResolvedValue(undefined),
  });

  it.each([
    ['listDepartments', ['department.read']],
    ['getDepartmentTree', ['department.read']],
    ['getDepartmentOptions', ['department.read']],
    ['getDepartment', ['department.read']],
    ['createDepartment', ['department.create']],
    ['updateDepartment', ['department.update']],
    ['deleteDepartment', ['department.delete']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(getPermissionsMetadata(method)).toEqual(permissions);
  });

  it('declares literal routes before the id route', () => {
    const routePaths = getRoutePaths();

    expect(routePaths.indexOf('tree')).toBeLessThan(routePaths.indexOf(':id'));
    expect(routePaths.indexOf('options')).toBeLessThan(
      routePaths.indexOf(':id'),
    );
  });

  it('delegates read endpoints to the service', async () => {
    const service = createService();
    const controller = new DepartmentController(
      service as unknown as DepartmentService,
    );
    const query = { page: 1, pageSize: 20, search: 'eng' };
    const optionsQuery = { includeIds: 'dept-2' };

    await expect(controller.listDepartments(query)).resolves.toBe(listDto);
    await expect(controller.getDepartmentTree()).resolves.toBe(treeDto);
    await expect(
      controller.getDepartmentOptions(optionsQuery),
    ).resolves.toBe(optionDto);
    await expect(controller.getDepartment('dept-1')).resolves.toBe(responseDto);

    expect(service.listDepartments).toHaveBeenCalledWith(query);
    expect(service.getDepartmentTree).toHaveBeenCalledWith();
    expect(service.getDepartmentOptions).toHaveBeenCalledWith(optionsQuery);
    expect(service.findById).toHaveBeenCalledWith('dept-1');
  });

  it('createDepartment passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DepartmentController(
      service as unknown as DepartmentService,
    );
    const body = { code: 'engineering', name: 'Engineering' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.createDepartment(body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.createDepartment).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('updateDepartment passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DepartmentController(
      service as unknown as DepartmentService,
    );
    const body = { name: 'Platform Engineering' };
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.updateDepartment('dept-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.updateDepartment).toHaveBeenCalledWith(
      'dept-1',
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('deleteDepartment passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new DepartmentController(
      service as unknown as DepartmentService,
    );
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.deleteDepartment('dept-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.deleteDepartment).toHaveBeenCalledWith(
      'dept-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        controllerMethod('deleteDepartment'),
      ),
    ).toBe(204);
  });
});
