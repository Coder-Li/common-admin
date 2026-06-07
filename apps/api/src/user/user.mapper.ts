import { Role } from './role.enum';
import { PublicUser, UserProfile } from './user.types';

interface PersistedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function toUserProfile(user: PersistedUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as Role,
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toUserResponse(
  user: PersistedUser & { createdAt: Date | string; updatedAt: Date | string },
): PublicUser {
  return {
    ...toUserProfile(user),
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}
