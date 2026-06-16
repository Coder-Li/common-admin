import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { SYSTEM_ROLE_CODES } from '../src/permission/permission.constants';
import { syncPermissions } from './permission-seed';
import { buildSystemRoleUpserts } from './seed-system-roles';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  for (const systemRole of buildSystemRoleUpserts()) {
    const { code, ...data } = systemRole;

    await prisma.role.upsert({
      where: { code },
      update: data,
      create: {
        code,
        ...data,
      },
    });
  }

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
