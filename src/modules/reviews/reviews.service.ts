import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';

import { buildPaginatedMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateReviewDto,
  RespondReviewDto,
  ReviewQueryDto,
} from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ReviewQueryDto) {
    const where: Prisma.ReviewWhereInput = {
      ...(q.partnerId ? { partnerId: q.partnerId } : {}),
      ...(q.rating ? { rating: q.rating } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: q.skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data: items, meta: buildPaginatedMeta(q.page, q.limit, total) };
  }

  async create(input: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Only completed bookings can be reviewed');
    }
    if (!booking.partnerId) {
      throw new BadRequestException('Booking has no partner');
    }
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          bookingId: input.bookingId,
          customerId: booking.customerId,
          partnerId: booking.partnerId!,
          rating: input.rating,
          comment: input.comment,
        },
      });
      // Update partner rating + totalJobs (running average)
      const agg = await tx.review.aggregate({
        where: { partnerId: booking.partnerId! },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.partner.update({
        where: { id: booking.partnerId! },
        data: {
          rating: new Prisma.Decimal((agg._avg.rating ?? 0).toFixed(2)),
          totalJobs: { increment: 1 },
        },
      });
      return review;
    });
  }

  async respond(id: string, input: RespondReviewDto) {
    return this.prisma.review.update({
      where: { id },
      data: { response: input.response, respondedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.prisma.review.delete({ where: { id } });
    return { success: true };
  }
}
