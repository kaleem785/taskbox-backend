import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { City, Zone, ZoneArea } from '../../prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';
import {
  CreateZoneAreaDto,
  CreateZoneDto,
  UpdateZoneDto,
} from './dto/zone.dto';

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

  // ── Zones ─────────────────────────────────────────────────────────────────

  listZones(opts: { cityId?: string; activeOnly?: boolean } = {}) {
    return this.prisma.zone.findMany({
      where: {
        ...(opts.cityId ? { cityId: opts.cityId } : {}),
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: [{ name: 'asc' }],
      include: {
        city: { select: { id: true, name: true, province: true } },
        areas: { orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] },
        _count: { select: { areas: true } },
      },
    });
  }

  async getZone(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: {
        city: { select: { id: true, name: true, province: true } },
        areas: { orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }

  /**
   * Reactivate-on-conflict for zones (mirrors createCity). Keyed off
   * @@unique([cityId, name]). Seed `areas` only when actually creating a new
   * zone — reactivating shouldn't silently inject areas into a row that
   * already has its own history.
   */
  async createZone(input: CreateZoneDto): Promise<Zone> {
    const { areas, ...rest } = input;

    const existing = await this.prisma.zone.findUnique({
      where: { cityId_name: { cityId: rest.cityId, name: rest.name } },
    });

    if (existing?.active) {
      throw new ConflictException(
        `Zone "${rest.name}" already exists in this city.`,
      );
    }

    if (existing) {
      return this.prisma.zone.update({
        where: { id: existing.id },
        data: {
          color: rest.color ?? existing.color,
          active: true,
        },
      });
    }

    return this.prisma.zone.create({
      data: {
        ...rest,
        areas: areas?.length
          ? {
              create: areas.map((name, i) => ({ name, displayOrder: i })),
            }
          : undefined,
      },
    });
  }

  updateZone(id: string, input: UpdateZoneDto): Promise<Zone> {
    const { areas: _ignore, ...rest } = input;
    return this.prisma.zone.update({ where: { id }, data: rest });
  }

  deactivateZone(id: string): Promise<Zone> {
    return this.prisma.zone.update({ where: { id }, data: { active: false } });
  }

  // ── Zone areas ────────────────────────────────────────────────────────────

  async addArea(zoneId: string, input: CreateZoneAreaDto): Promise<ZoneArea> {
    await this.getZone(zoneId);
    return this.prisma.zoneArea.create({ data: { zoneId, ...input } });
  }

  async removeArea(areaId: string): Promise<void> {
    await this.prisma.zoneArea.delete({ where: { id: areaId } });
  }
}
