import { Module } from '@nestjs/common';
import { PermissionModule } from '../permission/permission.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [PermissionModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
