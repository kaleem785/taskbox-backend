import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { ZonesService } from './zones.service';

/**
 * Unit tests for the shared City → Area → Zone coverage validator reused by
 * partner create/update, applicant apply, and approval. Prisma is fully mocked.
 */
describe('ZonesService.assertValidCoverage', () => {
  let service: ZonesService;
  let prisma: {
    area: { findMany: jest.Mock };
    zone: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      area: { findMany: jest.fn() },
      zone: { findMany: jest.fn() },
    };
    service = new ZonesService(prisma as unknown as PrismaService);
  });

  it('accepts a valid selection (area in city, zone in selected area, all active)', async () => {
    prisma.area.findMany.mockResolvedValue([
      { id: 'a1', cityId: 'c1', active: true },
    ]);
    prisma.zone.findMany.mockResolvedValue([
      { id: 'z1', areaId: 'a1', active: true },
    ]);

    await expect(
      service.assertValidCoverage('c1', ['a1'], ['z1']),
    ).resolves.toBeUndefined();
  });

  it('is a no-op when no areas or zones are selected', async () => {
    await expect(service.assertValidCoverage('c1', [], [])).resolves.toBeUndefined();
    expect(prisma.area.findMany).not.toHaveBeenCalled();
    expect(prisma.zone.findMany).not.toHaveBeenCalled();
  });

  it('rejects an area outside the selected city', async () => {
    prisma.area.findMany.mockResolvedValue([
      { id: 'a1', cityId: 'OTHER', active: true },
    ]);
    await expect(
      service.assertValidCoverage('c1', ['a1'], []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive area', async () => {
    prisma.area.findMany.mockResolvedValue([
      { id: 'a1', cityId: 'c1', active: false },
    ]);
    await expect(
      service.assertValidCoverage('c1', ['a1'], []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a zone whose area is not in the selected areas', async () => {
    prisma.area.findMany.mockResolvedValue([
      { id: 'a1', cityId: 'c1', active: true },
    ]);
    prisma.zone.findMany.mockResolvedValue([
      { id: 'z1', areaId: 'a2', active: true }, // a2 not selected
    ]);
    await expect(
      service.assertValidCoverage('c1', ['a1'], ['z1']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive zone', async () => {
    prisma.area.findMany.mockResolvedValue([
      { id: 'a1', cityId: 'c1', active: true },
    ]);
    prisma.zone.findMany.mockResolvedValue([
      { id: 'z1', areaId: 'a1', active: false },
    ]);
    await expect(
      service.assertValidCoverage('c1', ['a1'], ['z1']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
