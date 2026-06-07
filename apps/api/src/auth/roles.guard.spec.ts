import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../user/role.enum';
import { RolesGuard } from './roles.guard';

function createContext(role?: Role): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => ({
        user: role ? { role } : undefined,
      })),
    })),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows requests when no roles metadata is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows users whose role is included in roles metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(Role.ADMIN))).toBe(true);
  });

  it('rejects users whose role is missing from roles metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(Role.STANDARD))).toBe(false);
  });
});
