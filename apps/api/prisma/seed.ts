import {
  DictionaryBadgeVariant,
  DictionaryStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const userRoleType = await prisma.dictionaryType.upsert({
    where: { code: 'user_role' },
    update: {
      name: 'User role',
      status: DictionaryStatus.ACTIVE,
      isSystem: true,
    },
    create: {
      code: 'user_role',
      name: 'User role',
      status: DictionaryStatus.ACTIVE,
      isSystem: true,
    },
  });

  await prisma.dictionaryItem.upsert({
    where: {
      typeId_value: {
        typeId: userRoleType.id,
        value: Role.ADMIN,
      },
    },
    update: {
      label: 'Admin',
      sortOrder: 10,
      status: DictionaryStatus.ACTIVE,
      isSystem: true,
      badgeVariant: DictionaryBadgeVariant.DANGER,
    },
    create: {
      typeId: userRoleType.id,
      value: Role.ADMIN,
      label: 'Admin',
      sortOrder: 10,
      status: DictionaryStatus.ACTIVE,
      isSystem: true,
      badgeVariant: DictionaryBadgeVariant.DANGER,
    },
  });

  await prisma.dictionaryItem.upsert({
    where: {
      typeId_value: {
        typeId: userRoleType.id,
        value: Role.STANDARD,
      },
    },
    update: {
      label: 'Standard',
      sortOrder: 20,
      status: DictionaryStatus.ACTIVE,
      isSystem: true,
      badgeVariant: DictionaryBadgeVariant.NEUTRAL,
    },
    create: {
      typeId: userRoleType.id,
      value: Role.STANDARD,
      label: 'Standard',
      sortOrder: 20,
      status: DictionaryStatus.ACTIVE,
      isSystem: true,
      badgeVariant: DictionaryBadgeVariant.NEUTRAL,
    },
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
