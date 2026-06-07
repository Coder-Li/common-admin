import { Role } from './role.enum';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface JwtUserPayload extends UserProfile {
  sub: string;
}
