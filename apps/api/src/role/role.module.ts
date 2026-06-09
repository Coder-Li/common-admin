import { Module } from '@nestjs/common';
import { PermissionModule } from '../permission/permission.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [PrismaModule, PermissionModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
