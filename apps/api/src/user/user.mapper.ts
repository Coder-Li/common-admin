import {
  PublicUser,
  UserOrganizationSummary,
  UserProfile,
  UserRoleSummary,
} from './user.types';

interface OrganizationRecord {
  id: string;
  code: string;
  name: string;
  status: string;
  sortOrder?: number | null;
}

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
  departments?: Array<{
    isPrimary: boolean;
    department: OrganizationRecord;
  }>;
  positions?: Array<{
    position: OrganizationRecord;
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
  const departments = toDepartmentSummaries(user);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: toRoleSummaries(user),
    departments,
    primaryDepartment:
      departments.find((department) =>
        user.departments?.some(
          (userDepartment) =>
            userDepartment.isPrimary &&
            userDepartment.department.id === department.id,
        ),
      ) ?? null,
    positions: toPositionSummaries(user),
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

function toDepartmentSummaries(user: PersistedUser): UserOrganizationSummary[] {
  return [...(user.departments ?? [])]
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }

      return compareOrganizationRecords(a.department, b.department);
    })
    .map((userDepartment) => toOrganizationSummary(userDepartment.department));
}

function toPositionSummaries(user: PersistedUser): UserOrganizationSummary[] {
  return [...(user.positions ?? [])]
    .sort((a, b) => compareOrganizationRecords(a.position, b.position))
    .map((userPosition) => toOrganizationSummary(userPosition.position));
}

function compareOrganizationRecords(
  a: OrganizationRecord,
  b: OrganizationRecord,
): number {
  const sortOrderDelta = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

  if (sortOrderDelta !== 0) {
    return sortOrderDelta;
  }

  return a.name.localeCompare(b.name);
}

function toOrganizationSummary(
  organization: OrganizationRecord,
): UserOrganizationSummary {
  return {
    id: organization.id,
    code: organization.code,
    name: organization.name,
    status: organization.status,
  };
}
