import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DictionaryStatus, Prisma } from '@prisma/client';
import {
  ListResponse,
  createListResponse,
} from '../common/dto/list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../user/role.enum';
import { toDictionaryItemResponse } from './dictionary-item.mapper';
import {
  CreateDictionaryItemDto,
  DictionaryItemListQueryDto,
  UpdateDictionaryItemDto,
} from './dto/dictionary-item.request';
import { DictionaryItemResponseDto } from './dto/dictionary-item.response';

const DICTIONARY_ITEM_SORT_FIELDS = new Set([
  'value',
  'label',
  'sortOrder',
  'status',
  'isDefault',
  'createdAt',
  'updatedAt',
]);

const USER_ROLE_CODE = 'user_role';
const VALID_ROLE_VALUES = new Set<string>(Object.values(Role));

@Injectable()
export class DictionaryItemService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(
    query: DictionaryItemListQueryDto,
  ): Promise<ListResponse<DictionaryItemResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildItemWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.dictionaryItem.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
        include: { type: true },
      }),
      this.prisma.dictionaryItem.count({ where }),
    ]);

    return createListResponse(
      items.map((item) => toDictionaryItemResponse(item)),
      total,
      page,
      pageSize,
    );
  }

  async findById(id: string): Promise<DictionaryItemResponseDto> {
    const item = await this.prisma.dictionaryItem.findUnique({
      where: { id },
      include: { type: true },
    });

    if (!item) {
      throw new NotFoundException('Dictionary item not found');
    }

    return toDictionaryItemResponse(item);
  }

  async createItem(
    dto: CreateDictionaryItemDto,
  ): Promise<DictionaryItemResponseDto> {
    const type = await this.prisma.dictionaryType.findUnique({
      where: { id: dto.typeId },
    });

    if (!type) {
      throw new NotFoundException('Dictionary type not found');
    }

    this.assertValidUserRoleValue(type.code, dto.value);

    const data: Prisma.DictionaryItemUncheckedCreateInput = {
      typeId: dto.typeId,
      value: dto.value,
      label: dto.label,
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.badgeVariant !== undefined
        ? { badgeVariant: dto.badgeVariant }
        : {}),
      ...(dto.metadata !== undefined
        ? { metadata: dto.metadata as Prisma.InputJsonValue }
        : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
    };

    try {
      if (dto.isDefault) {
        const [, item] = await this.prisma.$transaction([
          this.prisma.dictionaryItem.updateMany({
            where: { typeId: dto.typeId, isDefault: true },
            data: { isDefault: false },
          }),
          this.prisma.dictionaryItem.create({
            data,
            include: { type: true },
          }),
        ]);

        return toDictionaryItemResponse(item);
      }

      const item = await this.prisma.dictionaryItem.create({
        data,
        include: { type: true },
      });

      return toDictionaryItemResponse(item);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async updateItem(
    id: string,
    dto: UpdateDictionaryItemDto,
  ): Promise<DictionaryItemResponseDto> {
    const existingItem = await this.prisma.dictionaryItem.findUnique({
      where: { id },
      include: { type: true },
    });

    if (!existingItem) {
      throw new NotFoundException('Dictionary item not found');
    }

    if (existingItem.isSystem && dto.status === DictionaryStatus.DISABLED) {
      throw new ConflictException('System dictionary item cannot be disabled');
    }

    if (dto.status === DictionaryStatus.ACTIVE) {
      this.assertValidUserRoleValue(existingItem.type.code, existingItem.value);
    }

    const data: Prisma.DictionaryItemUpdateInput = {
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.badgeVariant !== undefined
        ? { badgeVariant: dto.badgeVariant }
        : {}),
      ...(dto.metadata !== undefined
        ? { metadata: dto.metadata as Prisma.InputJsonValue }
        : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
    };

    try {
      if (dto.isDefault) {
        const [, item] = await this.prisma.$transaction([
          this.prisma.dictionaryItem.updateMany({
            where: {
              typeId: existingItem.typeId,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          }),
          this.prisma.dictionaryItem.update({
            where: { id },
            data,
            include: { type: true },
          }),
        ]);

        return toDictionaryItemResponse(item);
      }

      const item = await this.prisma.dictionaryItem.update({
        where: { id },
        data,
        include: { type: true },
      });

      return toDictionaryItemResponse(item);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async deleteItem(id: string): Promise<void> {
    const existingItem = await this.prisma.dictionaryItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      throw new NotFoundException('Dictionary item not found');
    }

    if (existingItem.isSystem) {
      throw new ConflictException('System dictionary item cannot be deleted');
    }

    try {
      await this.prisma.dictionaryItem.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  private parseSort(sort = 'sortOrder:asc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !DICTIONARY_ITEM_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid dictionary item sort');
    }

    return { field, direction };
  }

  private buildItemWhere(
    query: DictionaryItemListQueryDto,
  ): Prisma.DictionaryItemWhereInput {
    const where: Prisma.DictionaryItemWhereInput = {};

    if (query.typeId) {
      where.typeId = query.typeId;
    }

    if (query.typeCode) {
      where.type = { code: query.typeCode };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.isDefault !== undefined) {
      where.isDefault = query.isDefault;
    }

    if (query.search) {
      const search = {
        contains: query.search,
        mode: 'insensitive' as const,
      };

      where.OR = [
        { value: search },
        { label: search },
        { description: search },
      ];
    }

    return where;
  }

  private assertValidUserRoleValue(typeCode: string, value: string): void {
    if (typeCode === USER_ROLE_CODE && !VALID_ROLE_VALUES.has(value)) {
      throw new BadRequestException(
        'User role dictionary values must match backend roles',
      );
    }
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Dictionary item already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Dictionary item not found');
      }
    }

    throw error;
  }
}
