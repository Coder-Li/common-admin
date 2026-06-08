import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ListResponse,
  createListResponse,
} from '../common/dto/list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDictionaryTypeDto,
  DictionaryTypeListQueryDto,
  UpdateDictionaryTypeDto,
} from './dto/dictionary-type.request';
import { DictionaryTypeResponseDto } from './dto/dictionary-type.response';
import { toDictionaryTypeResponse } from './dictionary-type.mapper';

const DICTIONARY_TYPE_SORT_FIELDS = new Set([
  'code',
  'name',
  'status',
  'isSystem',
  'createdAt',
  'updatedAt',
]);

@Injectable()
export class DictionaryTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async listTypes(
    query: DictionaryTypeListQueryDto,
  ): Promise<ListResponse<DictionaryTypeResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [types, total] = await Promise.all([
      this.prisma.dictionaryType.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
      }),
      this.prisma.dictionaryType.count({ where }),
    ]);

    return createListResponse(
      types.map((type) => toDictionaryTypeResponse(type)),
      total,
      page,
      pageSize,
    );
  }

  async findById(id: string): Promise<DictionaryTypeResponseDto> {
    const type = await this.prisma.dictionaryType.findUnique({ where: { id } });

    if (!type) {
      throw new NotFoundException('Dictionary type not found');
    }

    return toDictionaryTypeResponse(type);
  }

  async createType(
    dto: CreateDictionaryTypeDto,
  ): Promise<DictionaryTypeResponseDto> {
    try {
      const type = await this.prisma.dictionaryType.create({ data: dto });

      return toDictionaryTypeResponse(type);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async updateType(
    id: string,
    dto: UpdateDictionaryTypeDto,
  ): Promise<DictionaryTypeResponseDto> {
    try {
      const type = await this.prisma.dictionaryType.update({
        where: { id },
        data: dto,
      });

      return toDictionaryTypeResponse(type);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async deleteType(id: string): Promise<void> {
    const type = await this.prisma.dictionaryType.findUnique({ where: { id } });

    if (!type) {
      throw new NotFoundException('Dictionary type not found');
    }

    if (type.isSystem) {
      throw new ConflictException('System dictionary type cannot be deleted');
    }

    const itemCount = await this.prisma.dictionaryItem.count({
      where: { typeId: id },
    });

    if (itemCount > 0) {
      throw new ConflictException('Dictionary type still has items');
    }

    try {
      await this.prisma.dictionaryType.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  private parseSort(sort = 'createdAt:desc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !DICTIONARY_TYPE_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid dictionary type sort');
    }

    return { field, direction };
  }

  private buildWhere(
    query: DictionaryTypeListQueryDto,
  ): Prisma.DictionaryTypeWhereInput {
    const where: Prisma.DictionaryTypeWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.isSystem !== undefined) {
      where.isSystem = query.isSystem;
    }

    if (query.search) {
      const search = {
        contains: query.search,
        mode: 'insensitive' as const,
      };

      where.OR = [{ code: search }, { name: search }, { description: search }];
    }

    return where;
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Dictionary type already exists');
      }

      if (error.code === 'P2003') {
        throw new ConflictException('Dictionary type still has items');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Dictionary type not found');
      }
    }

    throw error;
  }
}
