import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

const REFRESH_BYTES = 48;

/**
 * Refresh token format: `${tokenId}.${rawSecret}`
 * We store only the argon2 hash of rawSecret. The tokenId lets us look up the
 * single row without scanning all hashes.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueTokenPair(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds(),
    };
  }

  async signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.signAsync(payload);
  }

  async issueRefreshToken(userId: string, replacesTokenId?: string): Promise<string> {
    const rawSecret = randomBytes(REFRESH_BYTES).toString('base64url');
    const tokenHash = await argon2.hash(rawSecret, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ...(replacesTokenId
          ? {
              replacedFor: { connect: { id: replacesTokenId } },
            }
          : {}),
      },
    });

    return `${record.id}.${rawSecret}`;
  }

  async rotateRefreshToken(
    rawRefresh: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const { tokenId, rawSecret } = this.splitRefresh(rawRefresh);

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.revokedAt) {
      // Re-use detected: token was already rotated. Revoke all of user's tokens.
      await this.revokeAllForUser(record.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const valid = await argon2.verify(record.tokenHash, rawSecret);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      const newRaw = await this.issueRefreshTokenInTx(tx, record.userId, record.id);
      const accessToken = await this.signAccessToken(record.user);
      return {
        user: record.user,
        accessToken,
        refreshToken: newRaw,
        expiresIn: this.accessTtlSeconds(),
      };
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async issueRefreshTokenInTx(
    tx: Pick<PrismaService, 'refreshToken'>,
    userId: string,
    replacesTokenId: string,
  ): Promise<string> {
    const rawSecret = randomBytes(REFRESH_BYTES).toString('base64url');
    const tokenHash = await argon2.hash(rawSecret, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());
    const record = await tx.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        replacedFor: { connect: { id: replacesTokenId } },
      },
    });
    return `${record.id}.${rawSecret}`;
  }

  private splitRefresh(raw: string): { tokenId: string; rawSecret: string } {
    const idx = raw.indexOf('.');
    if (idx <= 0) throw new UnauthorizedException('Malformed refresh token');
    return { tokenId: raw.slice(0, idx), rawSecret: raw.slice(idx + 1) };
  }

  private accessTtlSeconds(): number {
    return parseDurationToMs(this.config.getOrThrow<string>('jwt.accessTtl')) / 1000;
  }

  private refreshTtlMs(): number {
    return parseDurationToMs(this.config.getOrThrow<string>('jwt.refreshTtl'));
  }
}

function parseDurationToMs(input: string): number {
  const m = /^(\d+)\s*([smhd])?$/.exec(input.trim());
  if (!m) return Number(input);
  const value = Number(m[1]);
  switch (m[2]) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
}
