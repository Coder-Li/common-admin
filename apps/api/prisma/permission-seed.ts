import type { PrismaClient } from '@prisma/client';
import { PERMISSION_REGISTRY } from '../src/permission/permission.registry';
import type { PermissionRegistryEntry } from '../src/permission/permission.types';

type RoleRef = { id: string; code: string };
type PermissionRef = { id: string };

export function buildPermissionUpserts(
  registry: readonly PermissionRegistryEntry[],
) {
  return registry.map((permission) => {
    const data = {
      module: permission.module,
      action: permission.action,
      name: permission.name,
      description: permission.description ?? null,
      isSystem: true,
      sortOrder: permission.sortOrder,
    };

    return {
      where: { code: permission.code },
      create: {
        code: permission.code,
        ...data,
      },
      update: data,
    };
  });
}

export function buildDefaultRolePermissionLinks(
  insertedPermissionCodes: Set<string>,
  registry: readonly PermissionRegistryEntry[],
  rolesByCode: Map<string, RoleRef>,
  permissionsByCode: Map<string, PermissionRef>,
) {
  return registry.flatMap((permission) => {
    if (!insertedPermissionCodes.has(permission.code)) {
      return [];
    }

    const permissionRecord = permissionsByCode.get(permission.code);

    if (!permissionRecord) {
      return [];
    }

    return permission.defaultRoles.flatMap((roleCode) => {
      const role = rolesByCode.get(roleCode);

      return role
        ? [{ roleId: role.id, permissionId: permissionRecord.id }]
        : [];
    });
  });
}

export async function syncPermissions(
  prisma: PrismaClient,
  registry: readonly PermissionRegistryEntry[] = PERMISSION_REGISTRY,
) {
  const insertedPermissionCodes = new Set<string>();

  for (const upsert of buildPermissionUpserts(registry)) {
    const existing = await prisma.permission.findUnique({
      where: upsert.where,
      select: { id: true },
    });

    if (!existing) {
      insertedPermissionCodes.add(upsert.where.code);
    }

    await prisma.permission.upsert(upsert);
  }

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { code: { in: [...new Set(registry.flatMap((p) => p.defaultRoles))] } },
      select: { id: true, code: true },
    }),
    prisma.permission.findMany({
      where: { code: { in: registry.map((permission) => permission.code) } },
      select: { id: true, code: true },
    }),
  ]);

  const links = buildDefaultRolePermissionLinks(
    insertedPermissionCodes,
    registry,
    new Map(roles.map((role) => [role.code, role])),
    new Map(
      permissions.map((permission) => [
        permission.code,
        { id: permission.id },
      ]),
    ),
  );

  for (const link of links) {
    await prisma.rolePermission.createMany({
      data: [link],
      skipDuplicates: true,
    });
  }

  return { insertedPermissionCodes };
}
