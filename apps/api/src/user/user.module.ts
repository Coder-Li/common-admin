import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DEMO_MODE_CONFIG, createDemoModeConfig } from '../config/demo.config';
import { PermissionModule } from '../permission/permission.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [AuditLogModule, PermissionModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: DEMO_MODE_CONFIG,
      inject: [ConfigService],
      useFactory: createDemoModeConfig,
    },
  ],
  exports: [UserService],
})
export class UserModule {}
