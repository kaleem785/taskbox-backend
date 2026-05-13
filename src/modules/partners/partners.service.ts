import { Injectable, NotFoundException } from '@nestjs/common';
import { Partner, Prisma } from '../../prisma/client';

import { buildPaginatedMeta, Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
} from './dto/partner.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    cityId?: string;
    zoneId?: string;
    verified?: boolean;
    availability?: boolean;
  }): Promise<Paginated<Partner>> {
    const { page, limit, search, categoryId, cityId, zoneId, verified, availability } =
      params;

    const where: Prisma.PartnerWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(zoneId ? { zones: { some: { zoneId } } } : {}),
      ...(verified !== undefined ? { verified } : {}),
      ...(availability !== undefined ? { availability } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: search } },
              { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ verified: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
        include: {
          category: { select: { id: true, name: true } },
          city: { select: { id: true, name: true } },
          zones: { include: { zone: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.partner.count({ where }),
    ]);

    return { data: items, meta: buildPaginatedMeta(page, limit, total) };
  }

  async get(id: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        city: { select: { id: true, name: true, province: true } },
        zones: { include: { zone: { include: { city: { select: { name: true } } } } } },
      },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async create(input: CreatePartnerDto): Promise<Partner> {
    const { zoneIds, ...rest } = input;
    return this.prisma.partner.create({
      data: {
        ...rest,
        zones: zoneIds?.length
          ? { create: zoneIds.map((zoneId) => ({ zoneId })) }
          : undefined,
      },
    });
  }

  async update(id: string, input: UpdatePartnerDto): Promise<Partner> {
    const { zoneIds, ...rest } = input;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.partner.update({ where: { id }, data: rest });
      if (zoneIds) {
        await tx.partnerZone.deleteMany({ where: { partnerId: id } });
        if (zoneIds.length) {
          await tx.partnerZone.createMany({
            data: zoneIds.map((zoneId) => ({ partnerId: id, zoneId })),
            skipDuplicates: true,
          });
        }
      }
      return updated;
    });
  }

  setAvailability(id: string, availability: boolean): Promise<Partner> {
    return this.prisma.partner.update({ where: { id }, data: { availability } });
  }

  assignZones(id: string, zoneIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.partnerZone.deleteMany({ where: { partnerId: id } });
      if (zoneIds.length) {
        await tx.partnerZone.createMany({
          data: zoneIds.map((zoneId) => ({ partnerId: id, zoneId })),
          skipDuplicates: true,
        });
      }
      return tx.partner.findUniqueOrThrow({
        where: { id },
        include: { zones: { include: { zone: true } } },
      });
    });
  }
}
