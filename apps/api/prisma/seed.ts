import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SYSTEM_ROLE_CODES } from '../src/permission/permission.constants';
import { syncPermissions } from './permission-seed';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  await prisma.role.upsert({
    where: { code: SYSTEM_ROLE_CODES.superAdmin },
    update: {
      name: 'Super admin',
      description: 'Full access to every active permission',
      status: 'ACTIVE',
      isSystem: true,
      isDefault: false,
    },
    create: {
      code: SYSTEM_ROLE_CODES.superAdmin,
      name: 'Super admin',
      description: 'Full access to every active permission',
      status: 'ACTIVE',
      isSystem: true,
      isDefault: false,
    },
  });

  await prisma.role.upsert({
    where: { code: SYSTEM_ROLE_CODES.admin },
    update: {
      name: 'Admin',
      description: 'Default administrator role',
      status: 'ACTIVE',
      isSystem: true,
      isDefault: false,
    },
    create: {
      code: SYSTEM_ROLE_CODES.admin,
      name: 'Admin',
      description: 'Default administrator role',
      status: 'ACTIVE',
      isSystem: true,
      isDefault: false,
    },
  });

  await prisma.role.upsert({
    where: { code: SYSTEM_ROLE_CODES.standard },
    update: {
      name: 'Standard',
      description: 'Default role for newly created users',
      status: 'ACTIVE',
      isSystem: true,
      isDefault: true,
    },
    create: {
      code: SYSTEM_ROLE_CODES.standard,
      name: 'Standard',
      description: 'Default role for newly created users',
      status: 'ACTIVE',
      isSystem: true,
      isDefault: true,
    },
  });

  await syncPermissions(prisma);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
    },
    create: {
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
    },
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { code: SYSTEM_ROLE_CODES.superAdmin },
    select: { id: true },
  });

  await prisma.userRole.createMany({
    data: [{ userId: adminUser.id, roleId: superAdminRole.id }],
    skipDuplicates: true,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
