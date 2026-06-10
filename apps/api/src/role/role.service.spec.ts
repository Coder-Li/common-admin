/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  const createPrismaMock = () => ({
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

  const role = (overrides: Record<string, unknown> = {}) => ({
    id: 'role-1',
    code: 'operator',
    name: 'Operator',
    description: null,
    status: 'ACTIVE',
    isSystem: false,
    isDefault: false,
    createdAt: new Date('2026-06-09T00:00:00.000Z'),
    updatedAt: new Date('2026-06-09T00:00:00.000Z'),
    permissions: [],
    ...overrides,
  });

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
      },
      include: expect.any(Object),
    });
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
        before: toRoleResponse(before),
        after: toRoleResponse(after),
      },
      tx,
    );
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

    await service.deleteRole('role-1', auditActor, auditRequestMeta);

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
        before: toRoleResponse(before),
      },
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
