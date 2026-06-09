/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    prisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(prisma),
    );
    const service = new RoleService(
      prisma as never,
      permissionService as never,
    );

    return { prisma, service };
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
    const { prisma, service } = createService();
    prisma.role.create.mockResolvedValue(role());

    await service.createRole({
      code: 'operator',
      name: 'Operator',
    });

    expect(prisma.role.create).toHaveBeenCalledWith({
      data: {
        code: 'operator',
        name: 'Operator',
        description: undefined,
        isDefault: false,
      },
      include: expect.any(Object),
    });
  });

  it('rejects duplicate role code', async () => {
    const { prisma, service } = createService();
    prisma.role.create.mockRejectedValue(
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
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.role.update.mockResolvedValue(role({ isDefault: true }));

    await service.updateRole('role-1', { isDefault: true });

    expect(prisma.role.updateMany).toHaveBeenCalledWith({
      where: { id: { not: 'role-1' }, status: 'ACTIVE', isDefault: true },
      data: { isDefault: false },
    });
  });

  it('replaces role permissions atomically', async () => {
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.permission.findMany.mockResolvedValue([
      { id: 'permission-1', code: 'user.read', status: 'ACTIVE' },
    ]);

    await service.replaceRolePermissions('role-1', ['user.read']);

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'role-1' },
    });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: 'role-1', permissionId: 'permission-1' }],
      skipDuplicates: true,
    });
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
    const { prisma, service } = createService();
    prisma.role.findUnique.mockResolvedValue(role());
    prisma.permission.findMany.mockResolvedValue([]);

    await service.replaceRolePermissions('role-1', []);

    expect(
      permissionService.invalidateAllPermissionContexts,
    ).toHaveBeenCalled();
  });
});
