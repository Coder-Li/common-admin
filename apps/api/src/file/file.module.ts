import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { LocalStorageService } from './storage/local-storage.service';
import { FILE_STORAGE } from './storage/storage.constants';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [FileController],
  providers: [
    FileService,
    LocalStorageService,
    {
      provide: FILE_STORAGE,
      useExisting: LocalStorageService,
    },
  ],
})
export class FileModule {}
