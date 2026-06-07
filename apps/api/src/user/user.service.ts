import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toUserProfile } from './user.mapper';
import { UserProfile } from './user.types';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findProfileById(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserProfile(user);
  }
}
