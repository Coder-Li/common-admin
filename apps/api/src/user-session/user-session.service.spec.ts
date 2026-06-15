/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit-log/audit-log.constants';
import type {
  AuditActor,
  AuditRequestMeta,
} from '../audit-log/audit-log.types';
import { UserSessionListQueryDto } from './dto/user-session.request';
import { UserSessionService } from './user-session.service';

describe('UserSessionListQueryDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transformQuery = (query: Record<string, unknown>) =>
    pipe.transform(query, {
      type: 'query',
      metatype: UserSessionListQueryDto,
    });

  it('defaults page and pageSize for an empty query', async () => {
    await expect(transformQuery({})).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it('accepts the active status filter', async () => {
    await expect(transformQuery({ status: 'active' })).resolves.toMatchObject({
      status: 'active',
    });
  });

  it.each([
    { status: 'disabled' },
    { dateFrom: 'not-a-date' },
    {
      dateFrom: '2026-06-15T00:00:00.000Z',
      dateTo: '2026-06-14T00:00:00.000Z',
    },
    { sort: 'email:asc' },
  ])('rejects invalid session list query %p', async (query) => {
    await expect(transformQuery(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('UserSessionService', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');
  type TransactionCallback = (tx: unknown) => unknown;

  const makeSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'sensitive-hash',
    userAgent: 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36',
    ipAddress: '203.0.113.10',
    createdAt: new Date('2026-06-14T08:00:00.000Z'),
    lastUsedAt: new Date('2026-06-14T09:00:00.000Z'),
    expiresAt: new Date('2026-06-15T08:00:00.000Z'),
    revokedAt: null,
    revokedReason: null,
    user: {
      id: 'user-1',
      username: 'ada',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    ...overrides,
  });

  const createPrismaMock = () => ({
    userSession: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (callback: TransactionCallback) =>
      callback(createPrismaMock()),
    ),
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    prisma.$transaction.mockImplementation(
      async (callback: TransactionCallback) => callback(tx),
    );
    const auditLogService = {
      record: jest.fn(),
    };
    class TestUserSessionService extends UserSessionService {
      protected override getNow(): Date {
        return now;
      }
    }

    const service = new TestUserSessionService(
      prisma as never,
      auditLogService as never,
    );

    prisma.userSession.findMany.mockResolvedValue([makeSession()]);
    prisma.userSession.count.mockResolvedValue(1);

    return { auditLogService, prisma, service, tx };
  };

  const auditActor: AuditActor = {
    userId: 'actor-1',
    email: 'actor@example.com',
    name: 'actor',
  };

  const auditRequestMeta: AuditRequestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lists sessions with default pagination and newest login sorting', async () => {
    const { prisma, service } = createService();

    await expect(service.listUserSessions({}, 'session-1')).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'session-1',
          status: 'active',
          isCurrentSession: true,
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(prisma.userSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        where: {},
        include: { user: true },
      }),
    );
    expect(prisma.userSession.count).toHaveBeenCalledWith({ where: {} });
  });

  it.each([
    ['active', { revokedAt: null, expiresAt: { gt: now } }],
    ['expired', { revokedAt: null, expiresAt: { lte: now } }],
    ['revoked', { revokedAt: { not: null } }],
  ] as const)('adds %s status filters', async (status, expectedWhere) => {
    const { prisma, service } = createService();

    await service.listUserSessions({ status }, 'current-session');

    expect(prisma.userSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
  });

  it('adds user, ip address, date, and search filters', async () => {
    const { prisma, service } = createService();

    await service.listUserSessions(
      {
        userId: 'user-1',
        ipAddress: '203.0.113',
        search: 'ada',
        dateFrom: '2026-06-01T00:00:00.000Z',
        dateTo: '2026-06-30T23:59:59.999Z',
      },
      'current-session',
    );

    expect(prisma.userSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          ipAddress: { contains: '203.0.113' },
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.999Z'),
          },
          user: {
            OR: [
              { username: { contains: 'ada', mode: 'insensitive' } },
              { email: { contains: 'ada', mode: 'insensitive' } },
              { firstName: { contains: 'ada', mode: 'insensitive' } },
              { lastName: { contains: 'ada', mode: 'insensitive' } },
            ],
          },
        },
      }),
    );
  });

  it('accepts supported sort fields', async () => {
    const { prisma, service } = createService();

    await service.listUserSessions(
      { page: 2, pageSize: 10, sort: 'lastUsedAt:asc' },
      'current-session',
    );

    expect(prisma.userSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { lastUsedAt: 'asc' },
      }),
    );
  });

  it.each([{ sort: 'email:asc' }, { sort: 'createdAt:sideways' }])(
    'rejects unsupported sort input %p',
    async (query) => {
      const { service } = createService();

      await expect(
        service.listUserSessions(query, 'current-session'),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('revokes another active session and records an audit log in the transaction', async () => {
    const { auditLogService, prisma, service, tx } = createService();
    prisma.userSession.findUnique.mockResolvedValue(makeSession());
    tx.userSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.revokeUserSession(
        'session-1',
        'current-session',
        auditActor,
        auditRequestMeta,
        { requestId: 'req_12345678' },
      ),
    ).resolves.toBeUndefined();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
        revokedReason: 'admin_revoked',
      },
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      {
        action: AUDIT_ACTIONS.REVOKE,
        resourceType: AUDIT_RESOURCE_TYPES.USER_SESSION,
        resourceId: 'session-1',
        actor: auditActor,
        requestMeta: auditRequestMeta,
        metadata: {
          requestId: 'req_12345678',
          targetUserId: 'user-1',
          targetUsername: 'ada',
          targetEmail: 'ada@example.com',
          ipAddress: '203.0.113.10',
          userAgent: 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36',
          createdAt: '2026-06-14T08:00:00.000Z',
          expiresAt: '2026-06-15T08:00:00.000Z',
          revokedReason: 'admin_revoked',
        },
      },
      tx,
    );
    expect(auditLogService.record.mock.calls[0][0].metadata).not.toHaveProperty(
      'refreshTokenHash',
    );
  });

  it('rejects revoking the current session', async () => {
    const { service } = createService();

    await expect(
      service.revokeUserSession('session-1', 'session-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing sessions', async () => {
    const { prisma, service } = createService();
    prisma.userSession.findUnique.mockResolvedValue(null);

    await expect(
      service.revokeUserSession('missing-session', 'current-session'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [
      'already revoked',
      {
        revokedAt: new Date('2026-06-14T10:00:00.000Z'),
        revokedReason: 'logout',
      },
    ],
    ['expired', { expiresAt: new Date('2026-06-14T12:00:00.000Z') }],
  ])('rejects %s sessions', async (_label, overrides) => {
    const { prisma, service } = createService();
    prisma.userSession.findUnique.mockResolvedValue(makeSession(overrides));

    await expect(
      service.revokeUserSession('session-1', 'current-session'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the conditional update no longer matches', async () => {
    const { prisma, service, tx } = createService();
    prisma.userSession.findUnique.mockResolvedValue(makeSession());
    tx.userSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.revokeUserSession('session-1', 'current-session'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
