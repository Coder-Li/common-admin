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

export interface PublicUser extends UserProfile {
  createdAt: string;
  updatedAt: string;
}

export type CreateUserInput = Omit<
  PublicUser,
  'id' | 'createdAt' | 'updatedAt'
> & {
  password: string;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>>;
