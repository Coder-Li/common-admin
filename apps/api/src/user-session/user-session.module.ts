import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserSessionController } from './user-session.controller';
import { UserSessionService } from './user-session.service';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [UserSessionController],
  providers: [UserSessionService],
})
export class UserSessionModule {}
