import { PublicUser, UserProfile, UserRoleSummary } from './user.types';

interface PersistedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  roles?: Array<{
    role: {
      code: string;
      name: string;
    };
  }>;
}

export function toUserProfile(
  user: PersistedUser,
  permissions: string[] = [],
): UserProfile {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: toRoleSummaries(user),
    permissions,
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toUserResponse(
  user: PersistedUser & { createdAt: Date | string; updatedAt: Date | string },
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: toRoleSummaries(user),
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}

function toRoleSummaries(user: PersistedUser): UserRoleSummary[] {
  return (user.roles ?? [])
    .map((userRole) => ({
      code: userRole.role.code,
      name: userRole.role.name,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
