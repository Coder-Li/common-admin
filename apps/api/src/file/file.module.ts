import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { LocalStorageService } from './storage/local-storage.service';
import { FILE_STORAGE } from './storage/storage.constants';

@Module({
  imports: [PrismaModule],
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
