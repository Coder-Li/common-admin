/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataScope, DepartmentStatus, Prisma } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import { toRoleResponse } from './role.mapper';
import { RoleService } from './role.service';

describe('RoleService', () => {
  type PrismaMock = {
    role: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    permission: {
      findMany: jest.Mock;
    };
    department: {
      findMany: jest.Mock;
    };
    rolePermission: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    userRole: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  type RoleMapperInput = Parameters<typeof toRoleResponse>[0];
  type DepartmentFixture = {
    id: string;
    code: string;
    name: string;
    status: DepartmentStatus;
  };
  type DataScopeDepartmentFixture = {
    roleId: string;
    departmentId: string;
    department: DepartmentFixture;
  };
  type DataScopeDepartmentOverride = Omit<
    Partial<DataScopeDepartmentFixture>,
    'department'
  > & {
    department?: Partial<DepartmentFixture>;
  };

  const createPrismaMock = (): PrismaMock => ({
    role: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userRole: {
      count: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => callback(createPrismaMock())),
  });

  const permissionService = {
    invalidateAllPermissionContexts: jest.fn(),
  };

  const createService = () => {
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(tx),
    );
    const auditLogService = {
      record: jest.fn(),
    };
    const service = new RoleService(
      prisma as never,
      permissionService as never,
      auditLogService as never,
    );

    return { auditLogService, prisma, service, tx };
  };

  const auditActor: AuditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'Actor',
  };

  const auditRequestMeta: AuditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
  const auditMetadata = {
    requestId: 'req_12345678',
  };

  const role = (overrides: Partial<RoleMapperInput> = {}): RoleMapperInput => ({
    id: 'role-1',
    code: 'operator',
    name: 'Operator',
    description: null,
    status: 'ACTIVE' as const,
    isSystem: false,
    isDefault: false,
    dataScope: DataScope.SELF,
    dataScopeDepartments: [],
    createdAt: new Date('2026-06-09T00:00:00.000Z'),
    updatedAt: new Date('2026-06-09T00:00:00.000Z'),
    permissions: [],
    ...overrides,
  });

  const department = (
    overrides: Partial<DepartmentFixture> = {},
  ): DepartmentFixture => ({
    id: 'dept-1',
    code: 'OPS',
    name: 'Operations',
    status: DepartmentStatus.ACTIVE,
    ...overrides,
  });

  const dataScopeDepartment = (
    overrides: DataScopeDepartmentOverride = {},
  ): DataScopeDepartmentFixture => {
    const linkedDepartment = department(overrides.department);
    const linkOverrides = Object.fromEntries(
      Object.entries(overrides).filter(([key]) => key !== 'department'),
    ) as Omit<DataScopeDepartmentOverride, 'department'>;

    return {
      roleId: 'role-1',
      departmentId: linkedDepartment.id,
      department: linkedDepartment,
      ...linkOverrides,
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a non-system role', async () => {
    const { service, tx } = createService();
    tx.role.create.mockResolvedValue(role());

    await service.createRole({
      code: 'operator',
      name: 'Operator',
    });

    expect(tx.role.create).toHaveBeenCalledWith({
      data: {
        code: 'operator',
        name: 'Operator',
        description: undefined,
        isDefault: false,
        dataScope: DataScope.SELF,
      },
      include: expect.any(Object),
    });
  });

  it('createRole persists SELF when dataScope is omitted', async () => {
    const { service, tx } = createService();
    tx.role.create.mockResolvedValue(role());

    await service.createRole({
      code: 'operator',
      name: 'Operator',
    });

    expect(tx.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataScope: DataScope.SELF,
        }),
      }),
    );
    expect(tx.department.findMany).not.toHaveBeenCalled();
  });

  it.each([
    DataScope.ALL,
    DataScope.SELF,
    DataScope.DEPT,
    DataScope.DEPT_AND_CHILDREN,
  ])(
    'createRole accepts %s without custom department ids',
    async (dataScope) => {
      const { service, tx } = createService();
      tx.role.create.mockResolvedValue(role({ dataScope }));

      await service.createRole({
        code: 'operator',
        name: 'Operator',
        dataScope,
      });

      expect(tx.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dataScope }),
        }),
      );
    },
  );

  it('createRole persists CUSTOM_DEPT nested department links', async () => {
    const { service, tx } = createService();
    tx.department.findMany.mockResolvedValue([
      department({ id: 'dept-2', code: 'FIN', name: 'Finance' }),
      department({ id: 'dept-1', code: 'OPS', name: 'Operations' }),
    ]);
    tx.role.create.mockResolvedValue(
      role({
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartments: [
          dataScopeDepartment({
            departmentId: 'dept-2',
            department: { id: 'dept-2', code: 'FIN', name: 'Finance' },
          }),
          dataScopeDepartment(),
        ],
      }),
    );

    await service.createRole({
      code: 'operator',
      name: 'Operator',
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartmentIds: ['dept-1', 'dept-2'],
    });

    expect(tx.department.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['dept-1', 'dept-2'] },
        status: DepartmentStatus.ACTIVE,
      },
      select: { id: true },
    });
    expect(tx.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataScope: DataScope.CUSTOM_DEPT,
          dataScopeDepartments: {
            createMany: {
              data: [{ departmentId: 'dept-1' }, { departmentId: 'dept-2' }],
            },
          },
        }),
      }),
    );
  });

  it('rejects CUSTOM_DEPT without department ids', async () => {
    const { service } = createService();

    await expect(
      service.createRole({
        code: 'operator',
        name: 'Operator',
        dataScope: DataScope.CUSTOM_DEPT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate custom department ids', async () => {
    const { service } = createService();

    await expect(
      service.createRole({
        code: 'operator',
        name: 'Operator',
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartmentIds: ['dept-1', 'dept-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects disabled custom departments', async () => {
    const { service, tx } = createService();
    tx.department.findMany.mockResolvedValue([]);

    await expect(
      service.createRole({
        code: 'operator',
        name: 'Operator',
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartmentIds: ['dept-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-custom scopes with department ids', async () => {
    const { service } = createService();

    await expect(
      service.createRole({
        code: 'operator',
        name: 'Operator',
        dataScope: DataScope.DEPT,
        dataScopeDepartmentIds: ['dept-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createRole writes create role audit log with after snapshot in the same transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const created = role();
    tx.role.create.mockResolvedValue(created);

    await service.createRole(
      {
        code: 'operator',
        name: 'Operator',
      },
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.any(Object),
      }),
    );
    expect(prisma.role.create).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.ROLE,
        resourceId: 'role-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
        after: toRoleResponse(created),
      },
      tx,
    );
  });

  it('rejects duplicate role code', async () => {
    const { service, tx } = createService();
    tx.role.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.createRole({ code: 'operator', name: 'Operator' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects deleting system role', async () => {
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(role({ isSystem: true }));

    await expect(service.deleteRole('role-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects disabling super_admin', async () => {
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(
      role({ code: 'super_admin', isSystem: true }),
    );

    await expect(
      service.updateRole('role-1', { status: 'DISABLED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces one active default role', async () => {
    const { prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    tx.role.findUnique.mockResolvedValue(role());
    tx.role.update.mockResolvedValue(role({ isDefault: true }));

    await service.updateRole('role-1', { isDefault: true });

    expect(tx.role.updateMany).toHaveBeenCalledWith({
      where: { id: { not: 'role-1' }, status: 'ACTIVE', isDefault: true },
      data: { isDefault: false },
    });
  });

  it('rejects clearing the only active default role', async () => {
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(role({ isDefault: true }));
    prisma.role.findFirst.mockResolvedValue(null);

    await expect(
      service.updateRole('role-1', { isDefault: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows clearing a disabled default role', async () => {
    const { prisma, service, tx } = createService();
    const disabledDefault = role({
      isDefault: true,
      status: 'DISABLED',
    });
    prisma.role.findUnique.mockResolvedValue(disabledDefault);
    tx.role.findUnique.mockResolvedValue(disabledDefault);
    tx.role.update.mockResolvedValue(
      role({
        isDefault: false,
        status: 'DISABLED',
      }),
    );

    await service.updateRole('role-1', { isDefault: false });

    expect(tx.role.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDefault: false }),
      }),
    );
  });

  it('updateRole reads before, updates, and writes before and after audit in the same transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const guardRole = role({ name: 'Operator' });
    const before = role({ name: 'Operator' });
    const after = role({ name: 'Operations' });
    prisma.role.findUnique.mockResolvedValue(guardRole);
    tx.role.findUnique.mockResolvedValue(before);
    tx.role.update.mockResolvedValue(after);

    await service.updateRole(
      'role-1',
      { name: 'Operations' },
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.role.findUnique).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      include: expect.any(Object),
    });
    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: { name: 'Operations' },
      include: expect.any(Object),
    });
    expect(prisma.role.update).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.ROLE,
        resourceId: 'role-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
        before: toRoleResponse(before),
        after: toRoleResponse(after),
      },
      tx,
    );
  });

  it('updateRole clears links when moving from CUSTOM_DEPT to SELF', async () => {
    const { prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    const after = role({ dataScope: DataScope.SELF });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);
    tx.role.update.mockResolvedValue(after);

    await service.updateRole('role-1', { dataScope: DataScope.SELF });

    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: {
        dataScope: DataScope.SELF,
        dataScopeDepartments: { deleteMany: {} },
      },
      include: expect.any(Object),
    });
  });

  it('updateRole replaces links when moving from SELF to CUSTOM_DEPT', async () => {
    const { prisma, service, tx } = createService();
    const before = role({ dataScope: DataScope.SELF });
    const after = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);
    tx.department.findMany.mockResolvedValue([department()]);
    tx.role.update.mockResolvedValue(after);

    await service.updateRole('role-1', {
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartmentIds: ['dept-1'],
    });

    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: {
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartments: {
          deleteMany: {},
          createMany: { data: [{ departmentId: 'dept-1' }] },
        },
      },
      include: expect.any(Object),
    });
  });

  it('keeps custom links on unrelated CUSTOM_DEPT updates', async () => {
    const { prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    const after = role({
      name: 'Operations',
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);
    tx.role.update.mockResolvedValue(after);

    await service.updateRole('role-1', { name: 'Operations' });

    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: { name: 'Operations' },
      include: expect.any(Object),
    });
  });

  it('rejects switching from SELF to CUSTOM_DEPT without ids', async () => {
    const { prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(
      role({ dataScope: DataScope.SELF }),
    );
    tx.role.findUnique.mockResolvedValue(role({ dataScope: DataScope.SELF }));

    await expect(
      service.updateRole('role-1', {
        dataScope: DataScope.CUSTOM_DEPT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects updating non-custom scope with department ids', async () => {
    const { prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);

    await expect(
      service.updateRole('role-1', {
        dataScope: DataScope.DEPT,
        dataScopeDepartmentIds: ['dept-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.role.update).not.toHaveBeenCalled();
  });

  it('clears links when non-custom scope receives explicit empty department ids', async () => {
    const { prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    const after = role({ dataScope: DataScope.DEPT });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);
    tx.role.update.mockResolvedValue(after);

    await service.updateRole('role-1', {
      dataScope: DataScope.DEPT,
      dataScopeDepartmentIds: [],
    });

    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: {
        dataScope: DataScope.DEPT,
        dataScopeDepartments: { deleteMany: {} },
      },
      include: expect.any(Object),
    });
  });

  it('rejects CUSTOM_DEPT updates with explicit empty department ids', async () => {
    const { prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);

    await expect(
      service.updateRole('role-1', {
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartmentIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.role.update).not.toHaveBeenCalled();
  });

  it('retains custom links when CUSTOM_DEPT is re-sent without ids', async () => {
    const { prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    const after = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);
    tx.role.update.mockResolvedValue(after);

    await service.updateRole('role-1', { dataScope: DataScope.CUSTOM_DEPT });

    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      data: { dataScope: DataScope.CUSTOM_DEPT },
      include: expect.any(Object),
    });
  });

  it('uses transaction-loaded dataScope for department id only updates', async () => {
    const { prisma, service, tx } = createService();
    const existingOutsideTransaction = role({ dataScope: DataScope.SELF });
    const beforeInsideTransaction = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    prisma.role.findUnique.mockResolvedValue(existingOutsideTransaction);
    tx.role.findUnique.mockResolvedValue(beforeInsideTransaction);
    tx.department.findMany.mockResolvedValue([
      department({ id: 'dept-2', code: 'FIN', name: 'Finance' }),
    ]);
    tx.role.update.mockResolvedValue(
      role({
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartments: [
          dataScopeDepartment({
            departmentId: 'dept-2',
            department: { id: 'dept-2', code: 'FIN', name: 'Finance' },
          }),
        ],
      }),
    );

    await service.updateRole('role-1', {
      dataScopeDepartmentIds: ['dept-2'],
    });

    expect(tx.role.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          dataScopeDepartments: {
            deleteMany: {},
            createMany: { data: [{ departmentId: 'dept-2' }] },
          },
        },
      }),
    );
  });

  it('does not pass dataScopeDepartmentIds into role update data', async () => {
    const { prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [dataScopeDepartment()],
    });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);
    tx.department.findMany.mockResolvedValue([
      department({ id: 'dept-2', code: 'FIN', name: 'Finance' }),
    ]);
    tx.role.update.mockResolvedValue(
      role({
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartments: [
          dataScopeDepartment({
            departmentId: 'dept-2',
            department: { id: 'dept-2', code: 'FIN', name: 'Finance' },
          }),
        ],
      }),
    );

    await service.updateRole('role-1', {
      dataScopeDepartmentIds: ['dept-2'],
    });

    expect(tx.role.update.mock.calls[0][0].data).not.toHaveProperty(
      'dataScopeDepartmentIds',
    );
    expect(tx.role.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataScopeDepartments: expect.objectContaining({
            deleteMany: {},
            createMany: { data: [{ departmentId: 'dept-2' }] },
          }),
        }),
      }),
    );
  });

  it('role responses include disabled stored links ordered by department code', async () => {
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(
      role({
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartments: [
          dataScopeDepartment({
            departmentId: 'dept-2',
            department: {
              id: 'dept-2',
              code: 'ZZZ',
              name: 'Closed',
              status: DepartmentStatus.DISABLED,
            },
          }),
          dataScopeDepartment({
            departmentId: 'dept-1',
            department: {
              id: 'dept-1',
              code: 'AAA',
              name: 'Active',
              status: DepartmentStatus.ACTIVE,
            },
          }),
        ],
      }),
    );

    await expect(service.findById('role-1')).resolves.toMatchObject({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [
        {
          id: 'dept-1',
          code: 'AAA',
          name: 'Active',
          status: DepartmentStatus.ACTIVE,
        },
        {
          id: 'dept-2',
          code: 'ZZZ',
          name: 'Closed',
          status: DepartmentStatus.DISABLED,
        },
      ],
    });
  });

  it('non-custom role responses serialize empty department links', async () => {
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(
      role({
        dataScope: DataScope.SELF,
        dataScopeDepartments: [dataScopeDepartment()],
      }),
    );

    await expect(service.findById('role-1')).resolves.toMatchObject({
      dataScope: DataScope.SELF,
      dataScopeDepartments: [],
    });
  });

  it('replaces role permissions atomically', async () => {
    const { prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.permission.findMany.mockResolvedValue([
      { id: 'permission-1', code: 'user.read', status: 'ACTIVE' },
    ]);
    tx.role.findUnique.mockResolvedValue(
      role({
        permissions: [
          { permission: { code: 'user.read', name: 'Read users' } },
        ],
      }),
    );

    await service.replaceRolePermissions('role-1', ['user.read']);

    expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'role-1' },
    });
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: 'role-1', permissionId: 'permission-1' }],
      skipDuplicates: true,
    });
  });

  it('deleteRole writes delete role audit log with before snapshot in the same transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const before = role();
    prisma.role.findUnique.mockResolvedValue(before);
    prisma.userRole.count.mockResolvedValue(0);
    tx.role.delete.mockResolvedValue(before);

    await service.deleteRole(
      'role-1',
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.role.delete).toHaveBeenCalledWith({
      where: { id: 'role-1' },
      include: expect.any(Object),
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.DELETE,
        resourceType: AUDIT_RESOURCE_TYPES.ROLE,
        resourceId: 'role-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
        before: toRoleResponse(before),
      },
      tx,
    );
  });

  it('invalidates permission cache only after successful role create transaction', async () => {
    const { auditLogService, service, tx } = createService();
    tx.role.create.mockResolvedValue(role());

    await service.createRole({
      code: 'operator',
      name: 'Operator',
    });

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    tx.role.create.mockResolvedValue(role());
    auditLogService.record.mockRejectedValue(new Error('audit failed'));

    await expect(
      service.createRole({
        code: 'operator',
        name: 'Operator',
      }),
    ).rejects.toThrow('audit failed');

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).not.toHaveBeenCalled();
  });

  it('invalidates permission cache only after successful role update transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    tx.role.findUnique.mockResolvedValue(role());
    tx.role.update.mockResolvedValue(role({ name: 'Operations' }));

    await service.updateRole('role-1', { name: 'Operations' });

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    prisma.role.findUnique.mockResolvedValue(role());
    tx.role.findUnique.mockResolvedValue(role());
    tx.role.update.mockResolvedValue(role({ name: 'Operations' }));
    auditLogService.record.mockRejectedValue(new Error('audit failed'));

    await expect(
      service.updateRole('role-1', { name: 'Operations' }),
    ).rejects.toThrow('audit failed');

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).not.toHaveBeenCalled();
  });

  it('invalidates permission cache only after successful role delete transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.userRole.count.mockResolvedValue(0);
    tx.role.delete.mockResolvedValue(role());

    await service.deleteRole('role-1');

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.userRole.count.mockResolvedValue(0);
    tx.role.delete.mockResolvedValue(role());
    auditLogService.record.mockRejectedValue(new Error('audit failed'));

    await expect(service.deleteRole('role-1')).rejects.toThrow('audit failed');

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).not.toHaveBeenCalled();
  });

  it('createRole audit snapshot includes ordered data scope department DTOs', async () => {
    const { auditLogService, service, tx } = createService();
    tx.department.findMany.mockResolvedValue([
      department({ id: 'dept-z', code: 'ZZZ', name: 'Zeta' }),
      department({ id: 'dept-a', code: 'AAA', name: 'Alpha' }),
    ]);
    tx.role.create.mockResolvedValue(
      role({
        dataScope: DataScope.CUSTOM_DEPT,
        dataScopeDepartments: [
          dataScopeDepartment({
            departmentId: 'dept-z',
            department: { id: 'dept-z', code: 'ZZZ', name: 'Zeta' },
          }),
          dataScopeDepartment({
            departmentId: 'dept-a',
            department: { id: 'dept-a', code: 'AAA', name: 'Alpha' },
          }),
        ],
      }),
    );

    await service.createRole({
      code: 'operator',
      name: 'Operator',
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartmentIds: ['dept-z', 'dept-a'],
    });

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          dataScope: DataScope.CUSTOM_DEPT,
          dataScopeDepartments: [
            {
              id: 'dept-a',
              code: 'AAA',
              name: 'Alpha',
              status: DepartmentStatus.ACTIVE,
            },
            {
              id: 'dept-z',
              code: 'ZZZ',
              name: 'Zeta',
              status: DepartmentStatus.ACTIVE,
            },
          ],
        }),
      }),
      tx,
    );
  });

  it('updateRole audit snapshots include ordered data scope department DTOs', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    const before = role({
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [
        dataScopeDepartment({
          departmentId: 'dept-z',
          department: { id: 'dept-z', code: 'ZZZ', name: 'Zeta' },
        }),
        dataScopeDepartment({
          departmentId: 'dept-a',
          department: { id: 'dept-a', code: 'AAA', name: 'Alpha' },
        }),
      ],
    });
    const after = role({
      name: 'Operations',
      dataScope: DataScope.CUSTOM_DEPT,
      dataScopeDepartments: [
        dataScopeDepartment({
          departmentId: 'dept-y',
          department: { id: 'dept-y', code: 'YYY', name: 'Yankee' },
        }),
        dataScopeDepartment({
          departmentId: 'dept-b',
          department: { id: 'dept-b', code: 'BBB', name: 'Beta' },
        }),
      ],
    });
    prisma.role.findUnique.mockResolvedValue(before);
    tx.role.findUnique.mockResolvedValue(before);
    tx.role.update.mockResolvedValue(after);

    await service.updateRole('role-1', { name: 'Operations' });

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({
          dataScope: DataScope.CUSTOM_DEPT,
          dataScopeDepartments: [
            {
              id: 'dept-a',
              code: 'AAA',
              name: 'Alpha',
              status: DepartmentStatus.ACTIVE,
            },
            {
              id: 'dept-z',
              code: 'ZZZ',
              name: 'Zeta',
              status: DepartmentStatus.ACTIVE,
            },
          ],
        }),
        after: expect.objectContaining({
          dataScope: DataScope.CUSTOM_DEPT,
          dataScopeDepartments: [
            {
              id: 'dept-b',
              code: 'BBB',
              name: 'Beta',
              status: DepartmentStatus.ACTIVE,
            },
            {
              id: 'dept-y',
              code: 'YYY',
              name: 'Yankee',
              status: DepartmentStatus.ACTIVE,
            },
          ],
        }),
      }),
      tx,
    );
  });

  it('replaceRolePermissions writes before and after permission code lists in the same transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.permission.findMany.mockResolvedValue([
      { id: 'permission-1', code: 'user.read', status: 'ACTIVE' },
      { id: 'permission-2', code: 'user.update', status: 'ACTIVE' },
    ]);
    tx.role.findUnique
      .mockResolvedValueOnce(
        role({
          permissions: [
            { permission: { code: 'setting.read', name: 'Read settings' } },
          ],
        }),
      )
      .mockResolvedValueOnce(
        role({
          permissions: [
            { permission: { code: 'user.read', name: 'Read users' } },
            { permission: { code: 'user.update', name: 'Update users' } },
          ],
        }),
      );

    await service.replaceRolePermissions(
      'role-1',
      ['user.update', 'user.read', 'user.read'],
      auditActor,
      auditRequestMeta,
      auditMetadata,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.role.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: 'role-1' },
      include: expect.any(Object),
    });
    expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'role-1' },
    });
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 'role-1', permissionId: 'permission-1' },
        { roleId: 'role-1', permissionId: 'permission-2' },
      ],
      skipDuplicates: true,
    });
    expect(tx.role.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 'role-1' },
      include: expect.any(Object),
    });
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.REPLACE_PERMISSIONS,
        resourceType: AUDIT_RESOURCE_TYPES.ROLE,
        resourceId: 'role-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        metadata: expect.objectContaining({ requestId: 'req_12345678' }),
        before: { permissionCodes: ['setting.read'] },
        after: { permissionCodes: ['user.read', 'user.update'] },
      },
      tx,
    );
  });

  it('rejects the business request when role audit recording fails inside a Prisma transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    tx.role.findUnique.mockResolvedValue(role());
    tx.role.update.mockResolvedValue(role({ name: 'Operations' }));
    auditLogService.record.mockRejectedValue(new Error('audit failed'));

    await expect(
      service.updateRole(
        'role-1',
        { name: 'Operations' },
        auditActor,
        auditRequestMeta,
      ),
    ).rejects.toThrow('audit failed');
  });

  it('rejects disabled permission assignment', async () => {
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.permission.findMany.mockResolvedValue([]);

    await expect(
      service.replaceRolePermissions('role-1', ['setting.update']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('invalidates permission cache after role permission replacement', async () => {
    const { prisma, service, tx } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.permission.findMany.mockResolvedValue([]);
    tx.role.findUnique.mockResolvedValue(role());

    await service.replaceRolePermissions('role-1', []);

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).toHaveBeenCalled();
  });
});
