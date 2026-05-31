import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Area, City, Prisma, Zone } from '../../prisma/client';

import { buildPaginatedMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';
import { CreateZoneDto, UpdateZoneDto } from './dto/zone.dto';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cities ────────────────────────────────────────────────────────────────

  listCities(opts: { activeOnly?: boolean; province?: string } = {}): Promise<City[]> {
    return this.prisma.city.findMany({
      where: {
        ...(opts.activeOnly ? { active: true } : {}),
        ...(opts.province ? { province: opts.province } : {}),
      },
      orderBy: [{ province: 'asc' }, { name: 'asc' }],
    });
  }

  async getCity(id: string): Promise<City> {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  /**
   * Reactivate-on-conflict: if a city with the same (name, province) already
   * exists, restore it (preserving id and all FK references from partners,
   * bookings, etc.) instead of inserting a duplicate or throwing on the
   * unique constraint. Reject only when the twin is already active.
   */
  async createCity(input: CreateCityDto): Promise<City> {
    const existing = await this.prisma.city.findUnique({
      where: { name_province: { name: input.name, province: input.province } },
    });

    if (existing?.active) {
      throw new ConflictException(
        `City "${input.name}" already exists in ${input.province}.`,
      );
    }

    if (existing) {
      return this.prisma.city.update({
        where: { id: existing.id },
        data: { name: input.name, province: input.province, active: true },
      });
    }

    return this.prisma.city.create({ data: { ...input, active: true } });
  }

  updateCity(id: string, input: UpdateCityDto): Promise<City> {
    return this.prisma.city.update({ where: { id }, data: input });
  }

  deactivateCity(id: string): Promise<City> {
    return this.prisma.city.update({ where: { id }, data: { active: false } });
  }

  // ── Areas ─────────────────────────────────────────────────────────────────

  /**
   * Lists areas. Backward compatible: returns the plain array unless BOTH
   * `page` and `limit` are supplied, in which case it returns the shared
   * `Paginated<T>` envelope (`{ data, meta }`) so the admin coverage picker can
   * page/search server-side without breaking existing array consumers.
   */
  async listAreas(opts: {
    cityId?: string;
    activeOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const where: Prisma.AreaWhereInput = {
      ...(opts.cityId ? { cityId: opts.cityId } : {}),
      ...(opts.activeOnly ? { active: true } : {}),
      ...(opts.search
        ? { name: { contains: opts.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    if (opts.page && opts.limit) {
      const { page, limit } = opts;
      const [data, total] = await this.prisma.$transaction([
        this.prisma.area.findMany({
          where,
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            city: { select: { id: true, name: true, province: true } },
          },
        }),
        this.prisma.area.count({ where }),
      ]);
      return { data, meta: buildPaginatedMeta(page, limit, total) };
    }

    return this.prisma.area.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        city: { select: { id: true, name: true, province: true } },
      },
    });
  }

  async getArea(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: {
        city: { select: { id: true, name: true, province: true } },
      },
    });
    if (!area) throw new NotFoundException('Area not found');
    return area;
  }

  async createArea(input: CreateAreaDto): Promise<Area> {
    const existing = await this.prisma.area.findUnique({
      where: { cityId_name: { cityId: input.cityId, name: input.name } },
    });

    if (existing?.active) {
      throw new ConflictException(
        `Area "${input.name}" already exists in this city.`,
      );
    }

    if (existing) {
      return this.prisma.area.update({
        where: { id: existing.id },
        data: { active: true },
      });
    }

    return this.prisma.area.create({ data: input });
  }

  updateArea(id: string, input: UpdateAreaDto): Promise<Area> {
    return this.prisma.area.update({ where: { id }, data: input });
  }

  deactivateArea(id: string): Promise<Area> {
    return this.prisma.area.update({ where: { id }, data: { active: false } });
  }

  // ── Zones ─────────────────────────────────────────────────────────────────

  /**
   * Lists zones. Same opt-in pagination contract as {@link listAreas}: plain
   * array unless both `page` and `limit` are given, otherwise `Paginated<T>`.
   * Per-area lazy loading uses the single-`areaId` path.
   */
  async listZones(opts: {
    areaId?: string;
    areaIds?: string[];
    activeOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const where: Prisma.ZoneWhereInput = {
      ...(opts.areaIds?.length
        ? { areaId: { in: opts.areaIds } }
        : opts.areaId
          ? { areaId: opts.areaId }
          : {}),
      ...(opts.activeOnly ? { active: true } : {}),
      ...(opts.search
        ? { name: { contains: opts.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    if (opts.page && opts.limit) {
      const { page, limit } = opts;
      const [data, total] = await this.prisma.$transaction([
        this.prisma.zone.findMany({
          where,
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            area: {
              select: {
                id: true,
                name: true,
                city: { select: { id: true, name: true, province: true } },
              },
            },
          },
        }),
        this.prisma.zone.count({ where }),
      ]);
      return { data, meta: buildPaginatedMeta(page, limit, total) };
    }

    return this.prisma.zone.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: {
        area: {
          select: {
            id: true,
            name: true,
            city: { select: { id: true, name: true, province: true } },
          },
        },
      },
    });
  }

  async getZone(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            city: { select: { id: true, name: true, province: true } },
          },
        },
      },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }

  /**
   * Reactivate-on-conflict for zones. Keyed off @@unique([areaId, name]).
   */
  async createZone(input: CreateZoneDto): Promise<Zone> {
    const existing = await this.prisma.zone.findUnique({
      where: { areaId_name: { areaId: input.areaId, name: input.name } },
    });

    if (existing?.active) {
      throw new ConflictException(
        `Zone "${input.name}" already exists in this area.`,
      );
    }

    if (existing) {
      return this.prisma.zone.update({
        where: { id: existing.id },
        data: { active: true },
      });
    }

    return this.prisma.zone.create({ data: input });
  }

  updateZone(id: string, input: UpdateZoneDto): Promise<Zone> {
    return this.prisma.zone.update({ where: { id }, data: input });
  }

  deactivateZone(id: string): Promise<Zone> {
    return this.prisma.zone.update({ where: { id }, data: { active: false } });
  }

  // ── Coverage validation (shared) ───────────────────────────────────────────

  /**
   * Validates a City → Areas → Zones coverage selection, the single source of
   * truth reused by partner create/update, applicant apply, and approval.
   *
   * Throws BadRequestException unless:
   *  - every selected area is active and belongs to `cityId`;
   *  - every selected zone is active and its `areaId` is one of `areaIds`.
   *
   * Loads the referenced areas + zones in one query each. A `null`/empty
   * selection is permitted (caller decides whether coverage is required).
   */
  async assertValidCoverage(
    cityId: string | null | undefined,
    areaIds: string[] = [],
    zoneIds: string[] = [],
  ): Promise<void> {
    if (!areaIds.length && !zoneIds.length) return;

    if (areaIds.length && !cityId) {
      throw new BadRequestException('cityId is required when areas are selected');
    }

    const uniqueAreaIds = [...new Set(areaIds)];
    const uniqueZoneIds = [...new Set(zoneIds)];

    if (zoneIds.length && !uniqueAreaIds.length) {
      throw new BadRequestException('At least one area must be selected to choose zones');
    }

    const areas = uniqueAreaIds.length
      ? await this.prisma.area.findMany({
          where: { id: { in: uniqueAreaIds } },
          select: { id: true, cityId: true, active: true },
        })
      : [];

    const areaById = new Map(areas.map((a) => [a.id, a]));
    for (const id of uniqueAreaIds) {
      const area = areaById.get(id);
      if (!area) throw new BadRequestException(`Area ${id} not found`);
      if (!area.active) throw new BadRequestException(`Area ${id} is inactive`);
      if (cityId && area.cityId !== cityId) {
        throw new BadRequestException(`Area ${id} does not belong to the selected city`);
      }
    }

    if (uniqueZoneIds.length) {
      const zones = await this.prisma.zone.findMany({
        where: { id: { in: uniqueZoneIds } },
        select: { id: true, areaId: true, active: true },
      });
      const zoneById = new Map(zones.map((z) => [z.id, z]));
      const selectedAreas = new Set(uniqueAreaIds);
      for (const id of uniqueZoneIds) {
        const zone = zoneById.get(id);
        if (!zone) throw new BadRequestException(`Zone ${id} not found`);
        if (!zone.active) throw new BadRequestException(`Zone ${id} is inactive`);
        if (!selectedAreas.has(zone.areaId)) {
          throw new BadRequestException(
            `Zone ${id} belongs to an area that is not selected`,
          );
        }
      }
    }
  }
}
