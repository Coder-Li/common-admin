import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentStatus, Prisma } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import { toDepartmentResponse } from './department.mapper';
import { DepartmentService } from './department.service';

describe('DepartmentService', () => {
  const timestamp = new Date('2026-06-15T00:00:00.000Z');

  const makeDepartment = (overrides: Record<string, unknown> = {}) => ({
    id: 'dept-1',
    code: 'engineering',
    name: 'Engineering',
    parentId: null,
    parent: null,
    status: DepartmentStatus.ACTIVE,
    sortOrder: 10,
    description: 'Engineering department',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  });

  const createPrismaMock = () => ({
    department: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userDepartment: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const auditLogService = {
      record: jest.fn(),
    };
    const ServiceCtor = DepartmentService as unknown as new (
      prisma: never,
      auditLogService: never,
    ) => DepartmentService;
    const service = new ServiceCtor(prisma as never, auditLogService as never);

    return { auditLogService, prisma, service, tx };
  };

  function firstMockArg<TArg>(mock: { mock: { calls: unknown[][] } }): TArg {
    const firstCall = mock.mock.calls[0];

    if (!firstCall) {
      throw new Error('Expected mock to have been called');
    }

    return firstCall[0] as TArg;
  }

  const uniqueConstraintError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const notFoundError = () =>
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });

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

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('listDepartments', () => {
    it('applies default pagination and default sort', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([makeDepartment()]);
      prisma.department.count.mockResolvedValue(1);

      await expect(service.listDepartments({})).resolves.toMatchObject({
        page: 1,
        pageSize: 20,
        total: 1,
      });

      expect(prisma.department.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { sortOrder: 'asc' },
        where: {},
        include: { parent: { select: { name: true } } },
      });
    });

    it('maps search to code, name, and description', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.listDepartments({ search: 'eng' });

      expect(
        firstMockArg<{ where: Prisma.DepartmentWhereInput }>(
          prisma.department.findMany,
        ).where,
      ).toEqual({
        OR: [
          { code: { contains: 'eng', mode: 'insensitive' } },
          { name: { contains: 'eng', mode: 'insensitive' } },
          { description: { contains: 'eng', mode: 'insensitive' } },
        ],
      });
    });

    it('applies status and parent filters', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.listDepartments({
        status: DepartmentStatus.DISABLED,
        parentId: 'parent-1',
      });

      expect(
        firstMockArg<{ where: Prisma.DepartmentWhereInput }>(
          prisma.department.findMany,
        ).where,
      ).toMatchObject({
        status: DepartmentStatus.DISABLED,
        parentId: 'parent-1',
      });
    });

    it('passes the same where object to findMany and count', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.listDepartments({
        search: 'eng',
        status: DepartmentStatus.ACTIVE,
      });

      const findManyWhere = firstMockArg<{
        where: Prisma.DepartmentWhereInput;
      }>(prisma.department.findMany).where;
      const countWhere = firstMockArg<{
        where: Prisma.DepartmentWhereInput;
      }>(prisma.department.count).where;

      expect(findManyWhere).toBe(countWhere);
      expect(countWhere.status).toBe(DepartmentStatus.ACTIVE);
    });

    it.each(['id:asc', 'sortOrder:sideways'])(
      'rejects invalid sort %s',
      async (sort) => {
        const { service } = createService();

        await expect(service.listDepartments({ sort })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  });

  describe('getDepartmentTree', () => {
    it('returns nested department data', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([
        makeDepartment({
          id: 'child',
          code: 'platform',
          name: 'Platform',
          parentId: 'root',
          sortOrder: 1,
        }),
        makeDepartment({
          id: 'root',
          code: 'engineering',
          name: 'Engineering',
          parentId: null,
          sortOrder: 1,
        }),
      ]);

      await expect(service.getDepartmentTree()).resolves.toEqual([
        expect.objectContaining({
          id: 'root',
          children: [expect.objectContaining({ id: 'child' })],
        }),
      ]);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          parentId: true,
          status: true,
          sortOrder: true,
        },
      });
    });
  });

  describe('getDepartmentOptions', () => {
    it('returns active records by default', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([makeDepartment()]);

      await service.getDepartmentOptions({});

      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: { status: DepartmentStatus.ACTIVE },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          parentId: true,
          status: true,
        },
      });
    });

    it('orders by sortOrder then name', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([]);

      await service.getDepartmentOptions({});

      expect(
        firstMockArg<{ orderBy: unknown }>(prisma.department.findMany).orderBy,
      ).toEqual([{ sortOrder: 'asc' }, { name: 'asc' }]);
    });

    it('includes disabled records named in includeIds', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([
        makeDepartment(),
        makeDepartment({
          id: 'disabled-dept',
          status: DepartmentStatus.DISABLED,
        }),
      ]);

      await expect(
        service.getDepartmentOptions({ includeIds: 'disabled-dept' }),
      ).resolves.toEqual([
        expect.objectContaining({ id: 'dept-1' }),
        expect.objectContaining({
          id: 'disabled-dept',
          status: DepartmentStatus.DISABLED,
        }),
      ]);

      expect(
        firstMockArg<{ where: Prisma.DepartmentWhereInput }>(
          prisma.department.findMany,
        ).where,
      ).toEqual({
        OR: [
          { status: DepartmentStatus.ACTIVE },
          { id: { in: ['disabled-dept'] } },
        ],
      });
    });

    it('ignores unknown includeIds naturally from query results', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([makeDepartment()]);

      await expect(
        service.getDepartmentOptions({ includeIds: 'missing-dept' }),
      ).resolves.toEqual([expect.objectContaining({ id: 'dept-1' })]);
    });

    it('deduplicates duplicate includeIds and duplicate response records', async () => {
      const { prisma, service } = createService();
      prisma.department.findMany.mockResolvedValue([
        makeDepartment(),
        makeDepartment(),
      ]);

      await expect(
        service.getDepartmentOptions({ includeIds: 'dept-1, dept-1' }),
      ).resolves.toHaveLength(1);
      expect(
        firstMockArg<{ where: Prisma.DepartmentWhereInput }>(
          prisma.department.findMany,
        ).where,
      ).toEqual({
        OR: [{ status: DepartmentStatus.ACTIVE }, { id: { in: ['dept-1'] } }],
      });
    });
  });

  describe('findById', () => {
    it('maps missing records to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-dept')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createDepartment', () => {
    it('maps duplicate code writes to ConflictException', async () => {
      const { service, tx } = createService();
      tx.department.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.createDepartment({
          code: 'engineering',
          name: 'Engineering',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a department and records audit data', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const createdDepartment = makeDepartment();
      tx.department.create.mockResolvedValue(createdDepartment);

      await expect(
        service.createDepartment(
          {
            code: 'engineering',
            name: 'Engineering',
          },
          auditActor,
          auditRequestMeta,
          auditMetadata,
        ),
      ).resolves.toEqual(toDepartmentResponse(createdDepartment));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.department.create).toHaveBeenCalledWith({
        data: {
          code: 'engineering',
          name: 'Engineering',
        },
        include: { parent: { select: { name: true } } },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.CREATE,
          resourceType: AUDIT_RESOURCE_TYPES.DEPARTMENT,
          resourceId: 'dept-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          metadata: expect.objectContaining({
            requestId: 'req_12345678',
          }) as unknown,
          after: toDepartmentResponse(createdDepartment),
        },
        tx,
      );
    });

    it('allows explicit parentId null to create a root department', async () => {
      const { service, tx } = createService();
      tx.department.create.mockResolvedValue(
        makeDepartment({ parentId: null }),
      );

      await service.createDepartment({
        code: 'engineering',
        name: 'Engineering',
        parentId: null as never,
      });

      expect(tx.department.findUnique).not.toHaveBeenCalled();
      expect(tx.department.create).toHaveBeenCalledWith({
        data: {
          code: 'engineering',
          name: 'Engineering',
          parentId: null,
        },
        include: { parent: { select: { name: true } } },
      });
    });

    it('rejects a disabled parent when explicitly selected', async () => {
      const { service, tx } = createService();
      tx.department.findUnique.mockResolvedValue(
        makeDepartment({
          id: 'parent-1',
          status: DepartmentStatus.DISABLED,
        }),
      );

      await expect(
        service.createDepartment({
          code: 'platform',
          name: 'Platform',
          parentId: 'parent-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.department.create).not.toHaveBeenCalled();
    });
  });

  describe('updateDepartment', () => {
    it('maps missing records to NotFoundException', async () => {
      const { service, tx } = createService();
      tx.department.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDepartment('missing-dept', { name: 'Missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps P2025 writes to NotFoundException', async () => {
      const { service, tx } = createService();
      tx.department.findUnique.mockResolvedValue(makeDepartment());
      tx.department.update.mockRejectedValue(notFoundError());

      await expect(
        service.updateDepartment('missing-dept', { name: 'Missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates a department and records audit data', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const before = makeDepartment({ name: 'Engineering' });
      const after = makeDepartment({ name: 'Engineering Group' });
      tx.department.findUnique.mockResolvedValue(before);
      tx.department.update.mockResolvedValue(after);

      await expect(
        service.updateDepartment(
          'dept-1',
          { name: 'Engineering Group' },
          auditActor,
          auditRequestMeta,
          auditMetadata,
        ),
      ).resolves.toEqual(toDepartmentResponse(after));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.department.findUnique).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        include: { parent: { select: { name: true } } },
      });
      expect(tx.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: { name: 'Engineering Group' },
        include: { parent: { select: { name: true } } },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.UPDATE,
          resourceType: AUDIT_RESOURCE_TYPES.DEPARTMENT,
          resourceId: 'dept-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          metadata: expect.objectContaining({
            requestId: 'req_12345678',
          }) as unknown,
          before: toDepartmentResponse(before),
          after: toDepartmentResponse(after),
        },
        tx,
      );
    });

    it('rejects self parent', async () => {
      const { service, tx } = createService();
      tx.department.findUnique.mockResolvedValue(makeDepartment());

      await expect(
        service.updateDepartment('dept-1', { parentId: 'dept-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.department.update).not.toHaveBeenCalled();
    });

    it('rejects a descendant parent', async () => {
      const { service, tx } = createService();
      tx.department.findUnique
        .mockResolvedValueOnce(makeDepartment())
        .mockResolvedValueOnce(
          makeDepartment({
            id: 'child-1',
            parentId: 'dept-1',
          }),
        );

      await expect(
        service.updateDepartment('dept-1', { parentId: 'child-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.department.update).not.toHaveBeenCalled();
    });

    it('sets explicit parentId null as a root department', async () => {
      const { service, tx } = createService();
      tx.department.findUnique.mockResolvedValue(
        makeDepartment({ parentId: 'parent-1' }),
      );
      tx.department.update.mockResolvedValue(
        makeDepartment({ parentId: null }),
      );

      await service.updateDepartment('dept-1', { parentId: null });

      expect(tx.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: { parentId: null },
        include: { parent: { select: { name: true } } },
      });
    });

    it('omits parentId to preserve an existing disabled parent', async () => {
      const { service, tx } = createService();
      tx.department.findUnique.mockResolvedValue(
        makeDepartment({
          parentId: 'disabled-parent',
          parent: { name: 'Disabled Parent' },
        }),
      );
      tx.department.update.mockResolvedValue(
        makeDepartment({
          name: 'Engineering Group',
          parentId: 'disabled-parent',
          parent: { name: 'Disabled Parent' },
        }),
      );

      await service.updateDepartment('dept-1', { name: 'Engineering Group' });

      expect(
        firstMockArg<{ data: Record<string, unknown> }>(tx.department.update)
          .data,
      ).not.toHaveProperty('parentId');
    });
  });

  describe('deleteDepartment', () => {
    it('maps missing records to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteDepartment('missing-dept'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects departments with child departments', async () => {
      const { auditLogService, prisma, service } = createService();
      prisma.department.findUnique.mockResolvedValue(makeDepartment());
      prisma.department.count.mockResolvedValue(1);

      await expect(service.deleteDepartment('dept-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('rejects departments with assigned users', async () => {
      const { auditLogService, prisma, service } = createService();
      prisma.department.findUnique.mockResolvedValue(makeDepartment());
      prisma.department.count.mockResolvedValue(0);
      prisma.userDepartment.count.mockResolvedValue(1);

      await expect(service.deleteDepartment('dept-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('deletes a department and records audit data', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const before = makeDepartment();
      prisma.department.findUnique.mockResolvedValue(before);
      prisma.department.count.mockResolvedValue(0);
      prisma.userDepartment.count.mockResolvedValue(0);
      tx.department.delete.mockResolvedValue(before);

      await service.deleteDepartment(
        'dept-1',
        auditActor,
        auditRequestMeta,
        auditMetadata,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.department.delete).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        include: { parent: { select: { name: true } } },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.DELETE,
          resourceType: AUDIT_RESOURCE_TYPES.DEPARTMENT,
          resourceId: 'dept-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          metadata: expect.objectContaining({
            requestId: 'req_12345678',
          }) as unknown,
          before: toDepartmentResponse(before),
        },
        tx,
      );
    });
  });
});
