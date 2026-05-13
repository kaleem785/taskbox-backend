import { Injectable } from '@nestjs/common';
import { BookingStatus, CommissionStatus, Prisma } from '../../prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [totalBookings, activePartners, revenue, pending] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.partner.count({ where: { verified: true, availability: true } }),
      this.prisma.booking.aggregate({
        where: { status: BookingStatus.COMPLETED, paymentStatus: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.applicant.count({ where: { status: 'PENDING' } }),
    ]);
    return {
      totalBookings,
      activePartners,
      revenue: Number(revenue._sum.amount ?? 0),
      pendingRequests: pending,
    };
  }

  async bookingsChart(days = 30) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', "scheduledDate"), 'YYYY-MM-DD') AS day,
             COUNT(*)::bigint AS count
      FROM bookings
      WHERE "scheduledDate" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((r) => ({ day: r.day, bookings: Number(r.count) }));
  }

  async serviceBreakdown() {
    const rows = await this.prisma.$queryRaw<
      { categoryId: string; name: string; count: bigint }[]
    >`
      SELECT c.id AS "categoryId", c.name, COUNT(b.id)::bigint AS count
      FROM categories c
      LEFT JOIN services s ON s."categoryId" = c.id
      LEFT JOIN bookings b ON b."serviceId" = s.id
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `;
    return rows.map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      bookings: Number(r.count),
    }));
  }

  topPartners(limit = 5) {
    return this.prisma.partner.findMany({
      where: { verified: true },
      orderBy: [{ rating: 'desc' }, { totalJobs: 'desc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        rating: true,
        totalJobs: true,
        category: { select: { name: true } },
      },
    });
  }

  liveDispatch() {
    return this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.PENDING, BookingStatus.AUTO_ASSIGNED] },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, phone: true } },
        partner: { select: { name: true, phone: true } },
        service: { select: { name: true } },
        customerAddress: {
          select: { area: true, assignedZone: { select: { name: true } } },
        },
      },
    });
  }

  async overdueCommissions() {
    return this.prisma.commission.findMany({
      where: {
        status: {
          in: [
            CommissionStatus.WARNING_1,
            CommissionStatus.WARNING_2,
            CommissionStatus.SUSPENDED,
          ],
        },
      },
      include: { partner: { select: { name: true } } },
    });
  }
}
