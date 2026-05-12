import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt, timingSafeEqual } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { UsersService } from '../users/users.service';
import { TokensService } from './tokens.service';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await this.users.verifyPassword(user, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const pair = await this.tokens.issueTokenPair(user);
    return { ...pair, user: this.publicUser(user) };
  }

  async refresh(refreshToken: string) {
    const result = await this.tokens.rotateRefreshToken(refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: this.publicUser(result.user),
    };
  }

  async logout(userId: string) {
    await this.tokens.revokeAllForUser(userId);
    return { success: true };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    // Always behave the same to avoid leaking which emails exist
    if (!user) {
      this.logger.debug({ email }, 'forgot-password: unknown email — no-op');
      return;
    }

    // One outstanding OTP per user: invalidate any prior unused ones.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const otp = generateNumericOtp(OTP_LENGTH);
    const otpHash = await argon2.hash(otp, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, otpHash, expiresAt },
    });

    await this.email.send(
      user.email,
      'Your TaskBox password reset code',
      `<p>Hello ${escapeHtml(user.name)},</p>
       <p>Your TaskBox password reset code is:</p>
       <p style="font-size:24px;letter-spacing:4px"><b>${otp}</b></p>
       <p>It expires in 15 minutes. If you didn't request this, ignore this email.</p>`,
    );
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid code');

    const record = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new UnauthorizedException('Invalid code');
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Code expired');
    }

    const ok = await argon2.verify(record.otpHash, otp);
    // Constant-time comparison of the result byte to defeat timing oracles
    if (!constantTimeBoolEq(ok, true)) {
      throw new UnauthorizedException('Invalid code');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.users.hashPassword(newPassword) },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}

function generateNumericOtp(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

function constantTimeBoolEq(a: boolean, b: boolean): boolean {
  const ba = Buffer.from([a ? 1 : 0]);
  const bb = Buffer.from([b ? 1 : 0]);
  return timingSafeEqual(ba, bb);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
