import { Injectable, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import * as argon2 from 'argon2';

import { PrismaService } from '../../prisma/prisma.service';

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(input: {
    email: string;
    password: string;
    name: string;
    role?: Role;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await this.hashPassword(input.password),
        name: input.name,
        role: input.role ?? Role.ADMIN,
      },
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.hashPassword(newPassword) },
    });
  }

  async verifyPassword(user: User, plain: string): Promise<boolean> {
    return argon2.verify(user.passwordHash, plain);
  }

  hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTS);
  }
}
