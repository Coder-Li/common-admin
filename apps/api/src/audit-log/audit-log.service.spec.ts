/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from './audit-log.constants';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  const makeAuditLog = (overrides: Record<string, unknown> = {}) => ({
    id: 'audit-log-1',
    actorUserId: 'user-1',
    actorEmail: 'admin@example.com',
    actorName: 'Admin User',
    action: AUDIT_ACTIONS.UPDATE,
    resourceType: AUDIT_RESOURCE_TYPES.USER,
    resourceId: 'target-user-1',
    before: { firstName: 'Ada' },
    after: { firstName: 'Augusta' },
    metadata: { reason: 'support' },
    ipAddress: '127.0.0.1',
    userAgent: 'Jest',
    createdAt: new Date('2026-06-07T01:02:03.000Z'),
    ...overrides,
  });

  const createPrismaMock = () => ({
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const service = new AuditLogService(prisma as never);

    return { prisma, service };
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('record writes actor, action, resource, request metadata, and sanitized snapshots', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.create.mockResolvedValue(makeAuditLog());

    await service.record({
      actor: {
        userId: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
      },
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: 'target-user-1',
      requestMeta: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
      },
      before: {
        email: 'old@example.com',
        password: 'old-secret',
      },
      after: null,
      metadata: {
        apiKey: 'secret-api-key',
        reason: 'support',
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'user-1',
        actorEmail: 'admin@example.com',
        actorName: 'Admin User',
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'target-user-1',
        before: {
          email: 'old@example.com',
          password: '[REDACTED]',
        },
        after: Prisma.JsonNull,
        metadata: {
          apiKey: '[REDACTED]',
          reason: 'support',
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
      },
    });
  });

  it('record writes through the passed transaction client', async () => {
    const { prisma, service } = createService();
    const tx = createPrismaMock();
    tx.auditLog.create.mockResolvedValue(makeAuditLog());

    await service.record(
      {
        action: AUDIT_ACTIONS.CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
      },
      tx as never,
    );

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: AUDIT_ACTIONS.CREATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
      },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('record omits before, after, and metadata from create payload when absent', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.create.mockResolvedValue(makeAuditLog());

    await service.record({
      action: AUDIT_ACTIONS.DELETE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: 'target-user-1',
    });

    const createPayload = prisma.auditLog.create.mock.calls[0][0]
      .data as Record<string, unknown>;

    expect(createPayload).not.toHaveProperty('before');
    expect(createPayload).not.toHaveProperty('after');
    expect(createPayload).not.toHaveProperty('metadata');
  });

  it('record normalizes sanitized payloads to Prisma JSON-safe values', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.create.mockResolvedValue(makeAuditLog());
    const occurredAt = new Date('2026-06-08T09:10:11.000Z');

    await service.record({
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      before: {
        occurredAt,
        version: BigInt('9007199254740993'),
        keep: 'value',
        dropUndefined: undefined,
        dropFunction: () => 'ignored',
        dropSymbol: Symbol('ignored'),
        nested: {
          password: 'secret',
          omitted: undefined,
        },
      },
      after: [
        occurredAt,
        BigInt(10),
        undefined,
        () => 'ignored',
        Symbol('ignored'),
        { apiKey: 'secret-api-key', ok: true },
      ],
      metadata: null,
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        before: {
          occurredAt: '2026-06-08T09:10:11.000Z',
          version: '9007199254740993',
          keep: 'value',
          nested: {
            password: '[REDACTED]',
          },
        },
        after: [
          '2026-06-08T09:10:11.000Z',
          '10',
          null,
          null,
          null,
          { apiKey: '[REDACTED]', ok: true },
        ],
        metadata: Prisma.JsonNull,
      },
    });
  });

  it('listAuditLogs defaults sort, page, and pageSize', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.findMany.mockResolvedValue([makeAuditLog()]);
    prisma.auditLog.count.mockResolvedValue(1);

    await expect(service.listAuditLogs({})).resolves.toEqual({
      items: [
        {
          id: 'audit-log-1',
          actorUserId: 'user-1',
          actorEmail: 'admin@example.com',
          actorName: 'Admin User',
          action: AUDIT_ACTIONS.UPDATE,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: 'target-user-1',
          ipAddress: '127.0.0.1',
          createdAt: '2026-06-07T01:02:03.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
      where: {},
    });
  });

  it('listAuditLogs omits null database fields from list items', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.findMany.mockResolvedValue([
      makeAuditLog({
        actorUserId: null,
        actorEmail: null,
        actorName: null,
        resourceId: null,
        ipAddress: null,
      }),
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    await expect(service.listAuditLogs({})).resolves.toEqual({
      items: [
        {
          id: 'audit-log-1',
          action: AUDIT_ACTIONS.UPDATE,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          createdAt: '2026-06-07T01:02:03.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('invalid sort field throws BadRequestException', async () => {
    const { service } = createService();

    await expect(
      service.listAuditLogs({ sort: 'email:asc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invalid sort direction throws BadRequestException', async () => {
    const { service } = createService();

    await expect(
      service.listAuditLogs({ sort: 'createdAt:sideways' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('malformed sort throws BadRequestException', async () => {
    const { service } = createService();

    await expect(
      service.listAuditLogs({ sort: 'createdAt:desc:any' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('search and filters build one shared where object for findMany and count', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    await service.listAuditLogs({
      page: 2,
      pageSize: 10,
      sort: 'action:asc',
      search: 'target-user-1',
      actorUserId: 'user-1',
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: 'target-user-1',
      dateFrom: '2026-06-01T00:00:00.000Z',
      dateTo: '2026-06-30T23:59:59.999Z',
    });

    const findManyArg = prisma.auditLog.findMany.mock.calls[0][0];
    const countArg = prisma.auditLog.count.mock.calls[0][0];

    expect(findManyArg.where).toBe(countArg.where);
    expect(findManyArg).toEqual({
      skip: 10,
      take: 10,
      orderBy: { action: 'asc' },
      where: {
        actorUserId: 'user-1',
        action: AUDIT_ACTIONS.UPDATE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: 'target-user-1',
        createdAt: {
          gte: new Date('2026-06-01T00:00:00.000Z'),
          lte: new Date('2026-06-30T23:59:59.999Z'),
        },
        OR: [
          { actorEmail: { contains: 'target-user-1', mode: 'insensitive' } },
          { actorName: { contains: 'target-user-1', mode: 'insensitive' } },
          { resourceId: { contains: 'target-user-1', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('findById maps detail records', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.findUnique.mockResolvedValue(makeAuditLog());

    await expect(service.findById('audit-log-1')).resolves.toEqual({
      id: 'audit-log-1',
      actorUserId: 'user-1',
      actorEmail: 'admin@example.com',
      actorName: 'Admin User',
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: 'target-user-1',
      before: { firstName: 'Ada' },
      after: { firstName: 'Augusta' },
      metadata: { reason: 'support' },
      ipAddress: '127.0.0.1',
      userAgent: 'Jest',
      createdAt: '2026-06-07T01:02:03.000Z',
    });
    expect(prisma.auditLog.findUnique).toHaveBeenCalledWith({
      where: { id: 'audit-log-1' },
    });
  });

  it('findById omits null database fields from detail records', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.findUnique.mockResolvedValue(
      makeAuditLog({
        actorUserId: null,
        actorEmail: null,
        actorName: null,
        resourceId: null,
        before: null,
        after: null,
        metadata: null,
        ipAddress: null,
        userAgent: null,
      }),
    );

    await expect(service.findById('audit-log-1')).resolves.toEqual({
      id: 'audit-log-1',
      action: AUDIT_ACTIONS.UPDATE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      createdAt: '2026-06-07T01:02:03.000Z',
    });
  });

  it('missing detail throws NotFoundException', async () => {
    const { prisma, service } = createService();
    prisma.auditLog.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing-log')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
