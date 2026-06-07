import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  ListResponse,
  createListResponse,
} from '../common/dto/list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
} from './dto/user.request';
import { UserResponseDto } from './dto/user.response';
import { toUserProfile, toUserResponse } from './user.mapper';
import { UserProfile } from './user.types';

const USER_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'email',
  'username',
  'firstName',
  'lastName',
  'role',
]);

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(
    query: UserListQueryDto,
  ): Promise<ListResponse<UserResponseDto>> {
    const { field, direction } = this.parseSort(query.sort);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildUserWhere(query);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [field]: direction },
        where,
      }),
      this.prisma.user.count({ where }),
    ]);

    return createListResponse(
      users.map((user) => toUserResponse(user)),
      total,
      page,
      pageSize,
    );
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserResponse(user);
  }

  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const { password, ...data } = dto;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...data,
          passwordHash,
        },
      });

      return toUserResponse(user);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: dto,
      });

      return toUserResponse(user);
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaWriteError(error);
    }
  }

  async findProfileById(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserProfile(user);
  }

  private parseSort(sort = 'createdAt:desc'): {
    field: string;
    direction: 'asc' | 'desc';
  } {
    const [field, direction] = sort.split(':');

    if (
      !field ||
      !USER_SORT_FIELDS.has(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new BadRequestException('Invalid user sort');
    }

    return { field, direction };
  }

  private buildUserWhere(query: UserListQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      const search = {
        contains: query.search,
        mode: 'insensitive' as const,
      };

      where.OR = [
        { email: search },
        { username: search },
        { firstName: search },
        { lastName: search },
      ];
    }

    return where;
  }

  private handlePrismaWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('User already exists');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
    }

    throw error;
  }
}
