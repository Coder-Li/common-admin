import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DictionaryItemController } from './dictionary-item.controller';
import { DictionaryItemService } from './dictionary-item.service';
import { DictionaryOptionsController } from './dictionary-options.controller';
import { DictionaryOptionsService } from './dictionary-options.service';
import { DictionaryTypeController } from './dictionary-type.controller';
import { DictionaryTypeService } from './dictionary-type.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    DictionaryTypeController,
    DictionaryItemController,
    DictionaryOptionsController,
  ],
  providers: [
    DictionaryTypeService,
    DictionaryItemService,
    DictionaryOptionsService,
  ],
})
export class DictionaryModule {}
