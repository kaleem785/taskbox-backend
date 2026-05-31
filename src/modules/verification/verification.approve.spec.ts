import { EventEmitter2 } from '@nestjs/event-emitter';

import { ApplicantStatus, DocumentType } from '../../prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZonesService } from '../zones/zones.service';
import { VerificationService } from './verification.service';

/**
 * Verifies that approving an applicant carries its submitted ApplicantArea /
 * ApplicantZone coverage (and its uploaded documents) into the created Partner.
 * Prisma is fully mocked — pure logic assertions, no DB.
 */
describe('VerificationService.approve coverage + document carry', () => {
  let service: VerificationService;
  let tx: {
    partner: { create: jest.Mock };
    applicant: { update: jest.Mock };
    activityLog: { create: jest.Mock };
  };
  let prisma: {
    applicant: { findUnique: jest.Mock };
    activityLog: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let zones: { assertValidCoverage: jest.Mock };

  const applicant = {
    id: 'app1',
    name: 'Ali',
    phone: '+923001112222',
    email: null,
    cnic: '35202-1',
    address: 'Street 1',
    experience: 'Y1_3',
    categoryId: 'cat1',
    cityId: 'c1',
    status: ApplicantStatus.FINAL_APPROVAL,
    areas: [{ applicantId: 'app1', areaId: 'a1' }],
    zones: [{ applicantId: 'app1', zoneId: 'z1' }],
    documents: [
      { type: DocumentType.CNIC_FRONT, fileKey: 'k-cnic', uploadedAt: new Date() },
      { type: DocumentType.SELFIE, fileKey: 'k-selfie', uploadedAt: new Date() },
      { type: DocumentType.CERTIFICATE, fileKey: null, uploadedAt: null },
    ],
  };

  beforeEach(() => {
    tx = {
      partner: { create: jest.fn().mockResolvedValue({ id: 'p1' }) },
      applicant: { update: jest.fn().mockResolvedValue({}) },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      applicant: { findUnique: jest.fn() },
      activityLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    zones = { assertValidCoverage: jest.fn().mockResolvedValue(undefined) };

    // First call: approve()'s load (documents/areas/zones). Second: get() detail.
    prisma.applicant.findUnique
      .mockResolvedValueOnce(applicant)
      .mockResolvedValue({ ...applicant, activityLog: [] });

    service = new VerificationService(
      prisma as unknown as PrismaService,
      new EventEmitter2() as unknown as EventEmitter2,
      zones as unknown as ZonesService,
    );
  });

  it('defaults coverage to the applicant selection and creates Partner join rows', async () => {
    await service.approve('app1', {}, { id: 'admin', name: 'admin@x' });

    expect(zones.assertValidCoverage).toHaveBeenCalledWith('c1', ['a1'], ['z1']);
    const data = tx.partner.create.mock.calls[0][0].data;
    expect(data.areas).toEqual({ create: [{ areaId: 'a1' }] });
    expect(data.zones).toEqual({ create: [{ zoneId: 'z1' }] });
    expect(data.applicantId).toBe('app1');
  });

  it('carries documents with fileKeys and sets profilePhotoKey from the selfie', async () => {
    await service.approve('app1', {}, { id: 'admin', name: 'admin@x' });

    const data = tx.partner.create.mock.calls[0][0].data;
    expect(data.profilePhotoKey).toBe('k-selfie');
    // Only the two docs that have fileKeys are carried (certificate is skipped).
    expect(data.documents.create).toHaveLength(2);
    expect(data.documents.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: DocumentType.CNIC_FRONT, fileKey: 'k-cnic' }),
        expect.objectContaining({ type: DocumentType.SELFIE, fileKey: 'k-selfie' }),
      ]),
    );
  });

  it('honours an explicit areaIds/zoneIds override', async () => {
    await service.approve(
      'app1',
      { areaIds: ['a2'], zoneIds: ['z2', 'z3'] },
      { id: 'admin', name: 'admin@x' },
    );

    expect(zones.assertValidCoverage).toHaveBeenCalledWith('c1', ['a2'], ['z2', 'z3']);
    const data = tx.partner.create.mock.calls[0][0].data;
    expect(data.zones).toEqual({ create: [{ zoneId: 'z2' }, { zoneId: 'z3' }] });
  });
});
