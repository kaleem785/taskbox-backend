import { Injectable } from '@nestjs/common';
import { BookingStatus, CommissionStatus } from '../../prisma/client';

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

  async liveDispatch() {
    const rows = await this.prisma.booking.findMany({
      where: {
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.AUTO_ASSIGNED,
            BookingStatus.CONFIRMED,
            BookingStatus.IN_PROGRESS,
          ],
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true } },
        partner: { select: { name: true } },
        service: { select: { name: true } },
        customerAddress: {
          select: { area: true, assignedZone: { select: { name: true } } },
        },
      },
    });

    // Flatten to a stable shape so the client never has to walk nested nulls.
    return rows.map((b) => ({
      id: b.id,
      status: b.status,
      scheduledDate: b.scheduledDate,
      customer: b.customer?.name ?? null,
      service: b.service?.name ?? null,
      partner: b.partner?.name ?? null,
      zone: b.customerAddress?.assignedZone?.name ?? b.customerAddress?.area ?? null,
    }));
  }

  async zoneHeatmap() {
    // Per-zone activity for the dashboard heatmap. Bookings attach to a zone via
    // customer_addresses.assigned_zone_id (the admin-mapped zone). "active" =
    // not completed/cancelled; trend = % change in bookings this 7d vs prior 7d.
    const rows = await this.prisma.$queryRaw<
      {
        name: string;
        city: string;
        activeBookings: bigint;
        totalBookings: bigint;
        partners: bigint;
        trend: number;
      }[]
    >`
      SELECT z.name AS name,
             c.name AS city,
             COUNT(b.id) FILTER (
               WHERE b.status NOT IN ('COMPLETED', 'CANCELLED')
             )::bigint AS "activeBookings",
             COUNT(b.id)::bigint AS "totalBookings",
             (
               SELECT COUNT(DISTINCT pz."partnerId")
               FROM partner_zones pz
               JOIN partners p ON p.id = pz."partnerId"
               WHERE pz."zoneId" = z.id
                 AND p.verified = true
                 AND p.availability = true
             )::bigint AS partners,
             COALESCE(
               ROUND(
                 (
                   COUNT(b.id) FILTER (WHERE b."createdAt" >= NOW() - INTERVAL '7 days')
                   - COUNT(b.id) FILTER (
                       WHERE b."createdAt" >= NOW() - INTERVAL '14 days'
                         AND b."createdAt" < NOW() - INTERVAL '7 days'
                     )
                 )::numeric
                 / NULLIF(
                     COUNT(b.id) FILTER (
                       WHERE b."createdAt" >= NOW() - INTERVAL '14 days'
                         AND b."createdAt" < NOW() - INTERVAL '7 days'
                     ),
                     0
                   ) * 100
               ),
               0
             )::int AS trend
      FROM zones z
      JOIN cities c ON c.id = z."cityId"
      LEFT JOIN customer_addresses ca ON ca."assignedZoneId" = z.id
      LEFT JOIN bookings b ON b."customerAddressId" = ca.id
      WHERE z.active = true
      GROUP BY z.id, z.name, c.name
      ORDER BY "activeBookings" DESC, "totalBookings" DESC
      LIMIT 8
    `;

    return rows.map((r) => ({
      name: r.name,
      city: r.city,
      activeBookings: Number(r.activeBookings),
      totalBookings: Number(r.totalBookings),
      partners: Number(r.partners),
      trend: Number(r.trend),
    }));
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
