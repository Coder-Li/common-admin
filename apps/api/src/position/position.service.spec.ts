import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PositionStatus, Prisma } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import { toPositionResponse } from './position.mapper';
import { PositionService } from './position.service';

describe('PositionService', () => {
  const timestamp = new Date('2026-06-15T00:00:00.000Z');

  const makePosition = (overrides: Record<string, unknown> = {}) => ({
    id: 'position-1',
    code: 'platform-engineer',
    name: 'Platform Engineer',
    status: PositionStatus.ACTIVE,
    sortOrder: 10,
    description: 'Builds internal platform capabilities',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  });

  const createPrismaMock = () => ({
    position: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userPosition: {
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
    const ServiceCtor = PositionService as unknown as new (
      prisma: never,
      auditLogService: never,
    ) => PositionService;
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

  const foreignKeyError = () =>
    new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
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

  describe('listPositions', () => {
    it('applies default pagination and default sortOrder:asc sort', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([makePosition()]);
      prisma.position.count.mockResolvedValue(1);

      await expect(service.listPositions({})).resolves.toMatchObject({
        page: 1,
        pageSize: 20,
        total: 1,
      });

      expect(prisma.position.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { sortOrder: 'asc' },
        where: {},
      });
    });

    it('maps search to code, name, and description', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([]);
      prisma.position.count.mockResolvedValue(0);

      await service.listPositions({ search: 'platform' });

      expect(
        firstMockArg<{ where: Prisma.PositionWhereInput }>(
          prisma.position.findMany,
        ).where,
      ).toEqual({
        OR: [
          { code: { contains: 'platform', mode: 'insensitive' } },
          { name: { contains: 'platform', mode: 'insensitive' } },
          { description: { contains: 'platform', mode: 'insensitive' } },
        ],
      });
    });

    it('applies the status filter', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([]);
      prisma.position.count.mockResolvedValue(0);

      await service.listPositions({ status: PositionStatus.DISABLED });

      expect(
        firstMockArg<{ where: Prisma.PositionWhereInput }>(
          prisma.position.findMany,
        ).where,
      ).toMatchObject({
        status: PositionStatus.DISABLED,
      });
    });

    it('passes the same where object to findMany and count', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([]);
      prisma.position.count.mockResolvedValue(0);

      await service.listPositions({
        search: 'platform',
        status: PositionStatus.ACTIVE,
      });

      const findManyWhere = firstMockArg<{
        where: Prisma.PositionWhereInput;
      }>(prisma.position.findMany).where;
      const countWhere = firstMockArg<{
        where: Prisma.PositionWhereInput;
      }>(prisma.position.count).where;

      expect(findManyWhere).toBe(countWhere);
      expect(countWhere.status).toBe(PositionStatus.ACTIVE);
    });

    it.each(['id:asc', 'sortOrder:sideways'])(
      'rejects invalid sort %s',
      async (sort) => {
        const { service } = createService();

        await expect(service.listPositions({ sort })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  });

  describe('getPositionOptions', () => {
    it('returns active records by default', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([makePosition()]);

      await service.getPositionOptions({});

      expect(prisma.position.findMany).toHaveBeenCalledWith({
        where: { status: PositionStatus.ACTIVE },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      });
    });

    it('orders by sortOrder then name', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([]);

      await service.getPositionOptions({});

      expect(
        firstMockArg<{ orderBy: unknown }>(prisma.position.findMany).orderBy,
      ).toEqual([{ sortOrder: 'asc' }, { name: 'asc' }]);
    });

    it('includes disabled records named in includeIds', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([
        makePosition(),
        makePosition({
          id: 'disabled-position',
          status: PositionStatus.DISABLED,
        }),
      ]);

      await expect(
        service.getPositionOptions({ includeIds: 'disabled-position' }),
      ).resolves.toEqual([
        expect.objectContaining({ id: 'position-1' }),
        expect.objectContaining({
          id: 'disabled-position',
          status: PositionStatus.DISABLED,
        }),
      ]);

      expect(
        firstMockArg<{ where: Prisma.PositionWhereInput }>(
          prisma.position.findMany,
        ).where,
      ).toEqual({
        OR: [
          { status: PositionStatus.ACTIVE },
          { id: { in: ['disabled-position'] } },
        ],
      });
    });

    it('ignores unknown includeIds naturally from query results', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([makePosition()]);

      await expect(
        service.getPositionOptions({ includeIds: 'missing-position' }),
      ).resolves.toEqual([expect.objectContaining({ id: 'position-1' })]);
    });

    it('deduplicates duplicate includeIds and duplicate response records', async () => {
      const { prisma, service } = createService();
      prisma.position.findMany.mockResolvedValue([
        makePosition(),
        makePosition(),
      ]);

      await expect(
        service.getPositionOptions({ includeIds: 'position-1, position-1' }),
      ).resolves.toHaveLength(1);
      expect(
        firstMockArg<{ where: Prisma.PositionWhereInput }>(
          prisma.position.findMany,
        ).where,
      ).toEqual({
        OR: [{ status: PositionStatus.ACTIVE }, { id: { in: ['position-1'] } }],
      });
    });
  });

  describe('findById', () => {
    it('maps missing records to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.position.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing-position')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createPosition', () => {
    it('creates a position and records audit data', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const createdPosition = makePosition();
      tx.position.create.mockResolvedValue(createdPosition);

      await expect(
        service.createPosition(
          {
            code: 'platform-engineer',
            name: 'Platform Engineer',
          },
          auditActor,
          auditRequestMeta,
          auditMetadata,
        ),
      ).resolves.toEqual(toPositionResponse(createdPosition));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.position.create).toHaveBeenCalledWith({
        data: {
          code: 'platform-engineer',
          name: 'Platform Engineer',
        },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.CREATE,
          resourceType: AUDIT_RESOURCE_TYPES.POSITION,
          resourceId: 'position-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          metadata: expect.objectContaining({
            requestId: 'req_12345678',
          }) as unknown,
          after: toPositionResponse(createdPosition),
        },
        tx,
      );
    });

    it('maps duplicate code writes to ConflictException', async () => {
      const { service, tx } = createService();
      tx.position.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.createPosition({
          code: 'platform-engineer',
          name: 'Platform Engineer',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updatePosition', () => {
    it('updates a position and records audit data', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const before = makePosition({ name: 'Platform Engineer' });
      const after = makePosition({ name: 'Senior Platform Engineer' });
      tx.position.findUnique.mockResolvedValue(before);
      tx.position.update.mockResolvedValue(after);

      await expect(
        service.updatePosition(
          'position-1',
          { name: 'Senior Platform Engineer' },
          auditActor,
          auditRequestMeta,
          auditMetadata,
        ),
      ).resolves.toEqual(toPositionResponse(after));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.position.findUnique).toHaveBeenCalledWith({
        where: { id: 'position-1' },
      });
      expect(tx.position.update).toHaveBeenCalledWith({
        where: { id: 'position-1' },
        data: { name: 'Senior Platform Engineer' },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.UPDATE,
          resourceType: AUDIT_RESOURCE_TYPES.POSITION,
          resourceId: 'position-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          metadata: expect.objectContaining({
            requestId: 'req_12345678',
          }) as unknown,
          before: toPositionResponse(before),
          after: toPositionResponse(after),
        },
        tx,
      );
    });

    it('maps missing records to NotFoundException', async () => {
      const { service, tx } = createService();
      tx.position.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePosition('missing-position', { name: 'Missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps P2025 writes to NotFoundException', async () => {
      const { service, tx } = createService();
      tx.position.findUnique.mockResolvedValue(makePosition());
      tx.position.update.mockRejectedValue(notFoundError());

      await expect(
        service.updatePosition('missing-position', { name: 'Missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deletePosition', () => {
    it('rejects positions with assigned users', async () => {
      const { auditLogService, prisma, service } = createService();
      prisma.position.findUnique.mockResolvedValue(makePosition());
      prisma.userPosition.count.mockResolvedValue(1);

      await expect(service.deletePosition('position-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('deletes a position and records audit data', async () => {
      const { auditLogService, prisma, service, tx } = createService();
      const before = makePosition();
      prisma.position.findUnique.mockResolvedValue(before);
      prisma.userPosition.count.mockResolvedValue(0);
      tx.position.delete.mockResolvedValue(before);

      await service.deletePosition(
        'position-1',
        auditActor,
        auditRequestMeta,
        auditMetadata,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.position.delete).toHaveBeenCalledWith({
        where: { id: 'position-1' },
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        {
          action: AUDIT_ACTIONS.DELETE,
          resourceType: AUDIT_RESOURCE_TYPES.POSITION,
          resourceId: 'position-1',
          actor: auditActor,
          requestMeta: auditRequestMeta,
          metadata: expect.objectContaining({
            requestId: 'req_12345678',
          }) as unknown,
          before: toPositionResponse(before),
        },
        tx,
      );
    });

    it('maps missing records to NotFoundException', async () => {
      const { prisma, service } = createService();
      prisma.position.findUnique.mockResolvedValue(null);

      await expect(
        service.deletePosition('missing-position'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps delete dependency races to BadRequestException', async () => {
      const { prisma, service, tx } = createService();
      prisma.position.findUnique.mockResolvedValue(makePosition());
      prisma.userPosition.count.mockResolvedValue(0);
      tx.position.delete.mockRejectedValue(foreignKeyError());

      await expect(service.deletePosition('position-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
