import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType, Partner, Prisma } from '../../prisma/client';

import { buildPaginatedMeta, Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ZonesService } from '../zones/zones.service';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
} from './dto/partner.dto';

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: ZonesService,
  ) {}

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
        documents: { orderBy: { type: 'asc' } },
        areas: {
          include: {
            area: { select: { id: true, name: true, cityId: true } },
          },
        },
        zones: {
          include: {
            zone: {
              include: {
                area: {
                  select: {
                    id: true,
                    name: true,
                    city: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async create(input: CreatePartnerDto): Promise<Partner> {
    const { areaIds, zoneIds, dob, ...rest } = input;
    await this.zones.assertValidCoverage(input.cityId, areaIds, zoneIds);
    try {
      return await this.prisma.partner.create({
        data: {
          ...rest,
          ...(dob ? { dob: new Date(dob) } : {}),
          areas: areaIds?.length
            ? { create: areaIds.map((areaId) => ({ areaId })) }
            : undefined,
          zones: zoneIds?.length
            ? { create: zoneIds.map((zoneId) => ({ zoneId })) }
            : undefined,
        },
      });
    } catch (err) {
      throw this.rethrowPhoneConflict(err);
    }
  }

  async update(id: string, input: UpdatePartnerDto): Promise<Partner> {
    const { areaIds, zoneIds, dob, ...rest } = input;
    // Validate against the partner's effective city (incoming, else stored).
    let cityId = input.cityId;
    if (cityId === undefined && (areaIds || zoneIds)) {
      const current = await this.prisma.partner.findUnique({
        where: { id },
        select: { cityId: true },
      });
      cityId = current?.cityId ?? undefined;
    }
    await this.zones.assertValidCoverage(cityId, areaIds, zoneIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.partner.update({
          where: { id },
          data: { ...rest, ...(dob !== undefined ? { dob: dob ? new Date(dob) : null } : {}) },
        });
        if (areaIds) {
          await tx.partnerArea.deleteMany({ where: { partnerId: id } });
          if (areaIds.length) {
            await tx.partnerArea.createMany({
              data: areaIds.map((areaId) => ({ partnerId: id, areaId })),
              skipDuplicates: true,
            });
          }
        }
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
    } catch (err) {
      throw this.rethrowPhoneConflict(err);
    }
  }

  setAvailability(id: string, availability: boolean): Promise<Partner> {
    return this.prisma.partner.update({ where: { id }, data: { availability } });
  }

  /**
   * Coverage update from the detail-page widget: replaces BOTH the area and
   * zone join tables atomically after validating the City→Area→Zone selection,
   * so the two can never drift out of sync.
   */
  async assignCoverage(id: string, areaIds: string[], zoneIds: string[]) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: { cityId: true },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    await this.zones.assertValidCoverage(partner.cityId, areaIds, zoneIds);
    return this.prisma.$transaction(async (tx) => {
      await tx.partnerArea.deleteMany({ where: { partnerId: id } });
      if (areaIds.length) {
        await tx.partnerArea.createMany({
          data: areaIds.map((areaId) => ({ partnerId: id, areaId })),
          skipDuplicates: true,
        });
      }
      await tx.partnerZone.deleteMany({ where: { partnerId: id } });
      if (zoneIds.length) {
        await tx.partnerZone.createMany({
          data: zoneIds.map((zoneId) => ({ partnerId: id, zoneId })),
          skipDuplicates: true,
        });
      }
      return tx.partner.findUniqueOrThrow({
        where: { id },
        include: {
          areas: { include: { area: { select: { id: true, name: true } } } },
          zones: { include: { zone: { select: { id: true, name: true } } } },
        },
      });
    });
  }

  async updateDocument(id: string, type: DocumentType, fileKey?: string) {
    await this.prisma.partner.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Partner not found');
    });
    return this.prisma.partnerDocument.upsert({
      where: { partnerId_type: { partnerId: id, type } },
      create: {
        partnerId: id,
        type,
        fileKey,
        uploadedAt: fileKey ? new Date() : null,
      },
      update: {
        ...(fileKey ? { fileKey, uploadedAt: new Date() } : {}),
      },
    });
  }

  private rethrowPhoneConflict(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      (err.meta?.target as string[] | undefined)?.includes('phone')
    ) {
      return new ConflictException('A partner with this phone already exists');
    }
    return err;
  }
}
