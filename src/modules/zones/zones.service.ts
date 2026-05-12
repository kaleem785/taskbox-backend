import { Injectable, NotFoundException } from '@nestjs/common';
import { City, Zone, ZoneArea } from '@prisma/client';

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

  createCity(input: CreateCityDto): Promise<City> {
    return this.prisma.city.create({ data: input });
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
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
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

  createZone(input: CreateZoneDto): Promise<Zone> {
    const { areas, ...rest } = input;
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
