import { DepartmentStatus } from '@prisma/client';
import { toDepartmentResponse, toDepartmentTree } from './department.mapper';

describe('department mapper', () => {
  const timestamp = new Date('2026-06-15T00:00:00.000Z');

  it('maps a department record to its public response fields', () => {
    const record = {
      id: 'dept-1',
      code: 'engineering',
      name: 'Engineering',
      parentId: null,
      status: DepartmentStatus.ACTIVE,
      sortOrder: 10,
      description: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      parent: null,
    };

    expect(toDepartmentResponse(record)).toMatchObject({
      id: 'dept-1',
      code: 'engineering',
      name: 'Engineering',
      parentId: null,
      parentName: null,
      status: 'ACTIVE',
      sortOrder: 10,
      description: null,
      createdAt: '2026-06-15T00:00:00.000Z',
      updatedAt: '2026-06-15T00:00:00.000Z',
    });
  });

  it('builds a department tree from flat records', () => {
    const records = [
      {
        id: 'child',
        code: 'platform',
        name: 'Platform',
        parentId: 'root',
        status: DepartmentStatus.ACTIVE,
        sortOrder: 10,
      },
      {
        id: 'root',
        code: 'engineering',
        name: 'Engineering',
        parentId: null,
        status: DepartmentStatus.ACTIVE,
        sortOrder: 1,
      },
    ];

    expect(toDepartmentTree(records)).toEqual([
      expect.objectContaining({
        id: 'root',
        children: [expect.objectContaining({ id: 'child' })],
      }),
    ]);
  });
});
