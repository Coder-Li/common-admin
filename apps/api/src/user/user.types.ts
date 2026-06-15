export interface UserRoleSummary {
  code: string;
  name: string;
}

export interface UserOrganizationSummary {
  id: string;
  code: string;
  name: string;
  status: string;
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
  sid: string;
  email?: string;
  username?: string;
}

export interface PublicUser extends Omit<UserProfile, 'permissions'> {
  departments: UserOrganizationSummary[];
  primaryDepartment: UserOrganizationSummary | null;
  positions: UserOrganizationSummary[];
  createdAt: string;
  updatedAt: string;
}

export type CreateUserInput = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  roleCodes?: string[];
  departmentIds?: string[];
  primaryDepartmentId?: string;
  positionIds?: string[];
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>>;
