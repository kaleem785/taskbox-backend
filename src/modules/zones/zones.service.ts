import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Area, City, Zone } from '../../prisma/client';

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

  listAreas(opts: { cityId?: string; activeOnly?: boolean } = {}) {
    return this.prisma.area.findMany({
      where: {
        ...(opts.cityId ? { cityId: opts.cityId } : {}),
        ...(opts.activeOnly ? { active: true } : {}),
      },
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
        data: {
          color: input.color ?? existing.color,
          active: true,
        },
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

  listZones(opts: { areaId?: string; activeOnly?: boolean } = {}) {
    return this.prisma.zone.findMany({
      where: {
        ...(opts.areaId ? { areaId: opts.areaId } : {}),
        ...(opts.activeOnly ? { active: true } : {}),
      },
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
        data: {
          color: input.color ?? existing.color,
          active: true,
        },
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
}
