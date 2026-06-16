import { DataScope, DepartmentStatus } from '@prisma/client';
import { PERMISSIONS_KEY } from '../auth/permissions.decorator';
import { setRequestId } from '../common/logging/request-context';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

describe('RoleController', () => {
  const permissionFor = (method: keyof RoleController) =>
    Reflect.getMetadata(PERMISSIONS_KEY, RoleController.prototype[method]) as
      | string[]
      | undefined;
  const responseDto = {
    id: 'role-1',
    code: 'operator',
    name: 'Operator',
    description: null,
    status: 'ACTIVE',
    isSystem: false,
    isDefault: false,
    dataScope: DataScope.SELF,
    dataScopeDepartments: [],
    permissions: [],
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
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
    listRoles: jest.fn(),
    createRole: jest.fn().mockResolvedValue(responseDto),
    findById: jest.fn(),
    updateRole: jest.fn().mockResolvedValue(responseDto),
    deleteRole: jest.fn().mockResolvedValue(undefined),
    replaceRolePermissions: jest.fn().mockResolvedValue(responseDto),
  });

  it.each([
    ['listRoles', ['role.read']],
    ['createRole', ['role.create']],
    ['getRole', ['role.read']],
    ['updateRole', ['role.update']],
    ['deleteRole', ['role.delete']],
    ['replaceRolePermissions', ['role.assign_permissions']],
  ] as const)('sets %s permission metadata', (method, permissions) => {
    expect(permissionFor(method)).toEqual(permissions);
  });

  it('createRole passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new RoleController(service as unknown as RoleService);
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.createRole(
        { code: 'operator', name: 'Operator' },
        user,
        request as never,
      ),
    ).resolves.toBe(responseDto);

    expect(service.createRole).toHaveBeenCalledWith(
      { code: 'operator', name: 'Operator' },
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('createRole passes data scope fields to the service', async () => {
    const service = createService();
    const controller = new RoleController(service as unknown as RoleService);
    const body = {
      code: 'operator',
      name: 'Operator',
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartmentIds: ['dept-1'],
    };

    await expect(
      controller.createRole(body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.createRole).toHaveBeenCalledWith(
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('updateRole passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new RoleController(service as unknown as RoleService);
    setRequestId(request as never, 'req_12345678');
    const body = { name: 'Operations' };

    await expect(
      controller.updateRole('role-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.updateRole).toHaveBeenCalledWith(
      'role-1',
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('updateRole passes data scope fields to the service', async () => {
    const service = createService();
    const controller = new RoleController(service as unknown as RoleService);
    const body = {
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartmentIds: ['dept-1'],
    };

    await expect(
      controller.updateRole('role-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.updateRole).toHaveBeenCalledWith(
      'role-1',
      body,
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('role response fixture includes data scope departments', () => {
    expect({
      ...responseDto,
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [
        {
          id: 'dept-1',
          code: 'OPS',
          name: 'Operations',
          status: DepartmentStatus.DISABLED,
        },
      ],
    }).toMatchObject({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [
        {
          id: 'dept-1',
          status: DepartmentStatus.DISABLED,
        },
      ],
    });
  });

  it('deleteRole passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new RoleController(service as unknown as RoleService);
    setRequestId(request as never, 'req_12345678');

    await expect(
      controller.deleteRole('role-1', user, request as never),
    ).resolves.toBeUndefined();

    expect(service.deleteRole).toHaveBeenCalledWith(
      'role-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });

  it('replaceRolePermissions passes request id audit metadata to the service', async () => {
    const service = createService();
    const controller = new RoleController(service as unknown as RoleService);
    setRequestId(request as never, 'req_12345678');
    const body = { permissionCodes: ['user.read'] };

    await expect(
      controller.replaceRolePermissions('role-1', body, user, request as never),
    ).resolves.toBe(responseDto);

    expect(service.replaceRolePermissions).toHaveBeenCalledWith(
      'role-1',
      ['user.read'],
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );
  });
});
