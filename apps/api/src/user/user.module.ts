import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PermissionModule } from '../permission/permission.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuditLogModule, PermissionModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
