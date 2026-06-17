import { Module } from '@nestjs/common';
import { PermissionModule } from '../permission/permission.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DataPermissionService } from './data-permission.service';

@Module({
  imports: [PrismaModule, PermissionModule],
  providers: [DataPermissionService],
  exports: [DataPermissionService],
})
export class DataPermissionModule {}
