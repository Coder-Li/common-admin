import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [PositionController],
  providers: [PositionService],
})
export class PositionModule {}
