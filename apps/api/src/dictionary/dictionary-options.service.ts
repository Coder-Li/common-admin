import { Injectable } from '@nestjs/common';
import { DictionaryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDictionaryOption } from './dictionary-options.mapper';
import {
  DictionaryOptionsMapResponseDto,
  DictionaryOptionsResponseDto,
} from './dto/dictionary-options.response';

const ACTIVE_OPTIONS_INCLUDE = {
  items: {
    where: { status: DictionaryStatus.ACTIVE },
    orderBy: [{ sortOrder: 'asc' as const }, { value: 'asc' as const }],
  },
};

@Injectable()
export class DictionaryOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptions(typeCode: string): Promise<DictionaryOptionsResponseDto> {
    const type = await this.prisma.dictionaryType.findFirst({
      where: { code: typeCode, status: DictionaryStatus.ACTIVE },
      include: ACTIVE_OPTIONS_INCLUDE,
    });

    return {
      typeCode,
      items: type?.items.map((item) => toDictionaryOption(item)) ?? [],
    };
  }

  async getOptionsMap(
    typeCodes: string[],
  ): Promise<DictionaryOptionsMapResponseDto> {
    const requestedCodes = [...new Set(typeCodes)];
    const types = await this.prisma.dictionaryType.findMany({
      where: {
        code: { in: requestedCodes },
        status: DictionaryStatus.ACTIVE,
      },
      include: ACTIVE_OPTIONS_INCLUDE,
    });
    const typesByCode = new Map(types.map((type) => [type.code, type]));

    return {
      dictionaries: Object.fromEntries(
        requestedCodes.map((code) => {
          const type = typesByCode.get(code);

          return [
            code,
            type?.items.map((item) => toDictionaryOption(item)) ?? [],
          ];
        }),
      ),
    };
  }
}
