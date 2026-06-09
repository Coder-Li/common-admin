export interface UserRoleSummary {
  code: string;
  name: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: UserRoleSummary[];
  permissions: string[];
}

export interface JwtUserPayload {
  sub: string;
  email?: string;
  username?: string;
}

export interface PublicUser extends Omit<UserProfile, 'permissions'> {
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
