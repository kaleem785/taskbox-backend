import { BadRequestException, NotFoundException } from '@nestjs/common';

import { BookingStatus } from '../../prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

/**
 * Focused on the denormalized Service.ratingAvg / reviewCount recompute hook
 * added alongside the catalog refactor. Prisma is fully mocked — these are
 * pure logic assertions, no DB.
 */
describe('ReviewsService rating recompute', () => {
  let service: ReviewsService;
  let tx: {
    review: { create: jest.Mock; aggregate: jest.Mock; delete: jest.Mock };
    partner: { update: jest.Mock };
    service: { update: jest.Mock };
  };
  let prisma: {
    booking: { findUnique: jest.Mock };
    review: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    tx = {
      review: { create: jest.fn(), aggregate: jest.fn(), delete: jest.fn() },
      partner: { update: jest.fn() },
      service: { update: jest.fn() },
    };
    prisma = {
      booking: { findUnique: jest.fn() },
      review: { findUnique: jest.fn() },
      // run the callback with our mocked transaction client
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    service = new ReviewsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const booking = {
      id: 'bk1',
      status: BookingStatus.COMPLETED,
      customerId: 'cust1',
      partnerId: 'ptr1',
      serviceId: 'svc1',
    };

    it('recomputes the service aggregate from booking.serviceId after creating', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking);
      tx.review.create.mockResolvedValue({ id: 'rev1' });
      // first aggregate call = partner, second = service
      tx.review.aggregate
        .mockResolvedValueOnce({ _avg: { rating: 4.5 }, _count: { _all: 10 } })
        .mockResolvedValueOnce({ _avg: { rating: 4.75 }, _count: { _all: 4 } });

      await service.create({ bookingId: 'bk1', rating: 5 });

      // service recompute scoped via the booking relation
      expect(tx.review.aggregate).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { booking: { serviceId: 'svc1' } } }),
      );
      expect(tx.service.update).toHaveBeenCalledWith({
        where: { id: 'svc1' },
        data: { ratingAvg: expect.anything(), reviewCount: 4 },
      });
      expect(tx.service.update.mock.calls[0][0].data.ratingAvg.toString()).toBe(
        '4.75',
      );
    });

    it('rejects a non-completed booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...booking,
        status: BookingStatus.PENDING,
      });
      await expect(service.create({ bookingId: 'bk1', rating: 5 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('recomputes after delete, nulling ratingAvg when no reviews remain', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'rev1',
        booking: { serviceId: 'svc1' },
      });
      tx.review.delete.mockResolvedValue({});
      tx.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { _all: 0 },
      });

      await service.remove('rev1');

      expect(tx.review.delete).toHaveBeenCalledWith({ where: { id: 'rev1' } });
      expect(tx.service.update).toHaveBeenCalledWith({
        where: { id: 'svc1' },
        data: { ratingAvg: null, reviewCount: 0 },
      });
    });

    it('throws when the review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
