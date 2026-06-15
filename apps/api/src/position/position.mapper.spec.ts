import { PositionStatus } from '@prisma/client';
import { toPositionOption, toPositionResponse } from './position.mapper';

describe('position mapper', () => {
  const timestamp = new Date('2026-06-15T00:00:00.000Z');

  it('maps a position record to its public response fields with ISO dates', () => {
    const record = {
      id: 'position-1',
      code: 'platform-engineer',
      name: 'Platform Engineer',
      status: PositionStatus.ACTIVE,
      sortOrder: 10,
      description: 'Builds internal platform capabilities',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    expect(toPositionResponse(record)).toEqual({
      id: 'position-1',
      code: 'platform-engineer',
      name: 'Platform Engineer',
      status: PositionStatus.ACTIVE,
      sortOrder: 10,
      description: 'Builds internal platform capabilities',
      createdAt: '2026-06-15T00:00:00.000Z',
      updatedAt: '2026-06-15T00:00:00.000Z',
    });
  });

  it('maps a position record to option fields only', () => {
    const record = {
      id: 'position-1',
      code: 'platform-engineer',
      name: 'Platform Engineer',
      status: PositionStatus.DISABLED,
    };

    expect(toPositionOption(record)).toEqual({
      id: 'position-1',
      code: 'platform-engineer',
      name: 'Platform Engineer',
      status: PositionStatus.DISABLED,
    });
  });
});
