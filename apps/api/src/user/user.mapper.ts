import { Role } from './role.enum';
import { UserProfile } from './user.types';

interface PersistedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role | string;
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
