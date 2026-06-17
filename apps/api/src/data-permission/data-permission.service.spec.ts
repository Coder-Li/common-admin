import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataPermissionService } from './data-permission.service';

describe('DataPermissionService', () => {
  const createPrismaMock = () => ({
    user: {
      findFirst: jest.fn(),
    },
  });

  const createPermissionServiceMock = () => ({
    resolveUserPermissionContext: jest.fn(),
  });

  const createService = () => {
    const prisma = createPrismaMock();
    const permissionService = createPermissionServiceMock();
    const service = new DataPermissionService(
      prisma as never,
      permissionService as never,
    );

    return { permissionService, prisma, service };
  };

  it('returns an empty where clause for ALL scope', async () => {
    const { permissionService, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
    });

    await expect(service.buildUserVisibilityWhere('actor-1')).resolves.toEqual(
      {},
    );
  });

  it('returns self visibility for SELF scope', async () => {
    const { permissionService, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: ['actor-1'],
        departmentIds: [],
      },
    });

    await expect(service.buildUserVisibilityWhere('actor-1')).resolves.toEqual({
      OR: [{ id: { in: ['actor-1'] } }],
    });
  });

  it('returns department visibility for limited departments', async () => {
    const { permissionService, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: [],
        departmentIds: ['dept-1', 'dept-2'],
      },
    });

    await expect(service.buildUserVisibilityWhere('actor-1')).resolves.toEqual({
      OR: [
        {
          departments: {
            some: { departmentId: { in: ['dept-1', 'dept-2'] } },
          },
        },
      ],
    });
  });

  it('returns union visibility for self and department limited scopes', async () => {
    const { permissionService, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: ['actor-1'],
        departmentIds: ['dept-1'],
      },
    });

    await expect(service.buildUserVisibilityWhere('actor-1')).resolves.toEqual({
      OR: [
        { id: { in: ['actor-1'] } },
        {
          departments: {
            some: { departmentId: { in: ['dept-1'] } },
          },
        },
      ],
    });
  });

  it('returns an impossible where clause for an empty limited scope', async () => {
    const { permissionService, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
    });

    await expect(service.buildUserVisibilityWhere('actor-1')).resolves.toEqual({
      id: { in: [] },
    });
  });

  it('assertCanAccessUser resolves for visible targets', async () => {
    const { permissionService, prisma, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: ['actor-1'],
        departmentIds: [],
      },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'actor-1' });

    await expect(
      service.assertCanAccessUser('actor-1', 'actor-1'),
    ).resolves.toBeUndefined();
  });

  it('assertCanAccessUser throws not found for invisible targets', async () => {
    const { permissionService, prisma, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: { mode: 'LIMITED', selfUserIds: [], departmentIds: [] },
    });
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCanAccessUser('actor-1', 'target-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assertCanAssignDepartments allows ALL', async () => {
    const { permissionService, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: { mode: 'ALL', selfUserIds: [], departmentIds: [] },
    });

    await expect(
      service.assertCanAssignDepartments('actor-1', ['dept-1']),
    ).resolves.toBeUndefined();
  });

  it('assertCanAssignDepartments rejects out-of-scope departments', async () => {
    const { permissionService, service } = createService();
    permissionService.resolveUserPermissionContext.mockResolvedValue({
      dataScope: {
        mode: 'LIMITED',
        selfUserIds: [],
        departmentIds: ['dept-1'],
      },
    });

    await expect(
      service.assertCanAssignDepartments('actor-1', ['dept-2']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
