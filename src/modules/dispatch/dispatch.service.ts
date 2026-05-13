import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignedBy, BookingStatus, Partner } from '../../prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export const DISPATCH_EVENTS = {
  BOOKING_ASSIGNED: 'booking.assigned',
  BOOKING_DISPATCH_FAILED: 'booking.dispatch_failed',
  BOOKING_REASSIGNED: 'booking.reassigned',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_STATUS_CHANGED: 'booking.status_changed',
} as const;

export interface DispatchResult {
  partnerId: string | null;
  reason?: string;
}

/**
 * Auto-dispatch — mirrors the algorithm in
 * TaskBox-Admin/src/services/autoDispatchService.ts + src/utils/dispatchHelpers.ts.
 *
 *  • Customer's address MUST have an assignedZoneId (admin-mapped via the
 *    Daraz-style manual flow).
 *  • Service category must equal partner.categoryId (case-sensitive on UUIDs).
 *  • Partner must be verified + available.
 *  • Pick the highest-rated match, then break ties by totalJobs.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async dispatch(bookingId: string): Promise<DispatchResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customerAddress: true,
        service: { select: { categoryId: true } },
      },
    });
    if (!booking) {
      this.logger.warn(`dispatch(): booking ${bookingId} not found`);
      return { partnerId: null, reason: 'booking_not_found' };
    }
    if (booking.status !== BookingStatus.PENDING) {
      return { partnerId: null, reason: `already_${booking.status}` };
    }
    if (!booking.customerAddress.assignedZoneId) {
      return await this.failDispatch(bookingId, 'address_zone_not_mapped');
    }

    const candidates = await this.findCandidates({
      zoneId: booking.customerAddress.assignedZoneId,
      categoryId: booking.service.categoryId,
    });

    if (candidates.length === 0) {
      return await this.failDispatch(bookingId, 'no_partners_available');
    }

    const top = candidates[0];
    const assigned = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          partnerId: top.id,
          status: BookingStatus.AUTO_ASSIGNED,
          autoAssigned: true,
          assignedAt: new Date(),
          assignedBy: AssignedBy.SYSTEM,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.AUTO_ASSIGNED,
          reason: `Auto-assigned to ${top.name} (rating ${top.rating.toString()})`,
        },
      });
      return updated;
    });

    this.events.emit(DISPATCH_EVENTS.BOOKING_ASSIGNED, {
      bookingId,
      partnerId: top.id,
      partnerName: top.name,
      assignedBy: AssignedBy.SYSTEM,
      booking: assigned,
    });

    return { partnerId: top.id };
  }

  async findCandidates(input: {
    zoneId: string;
    categoryId: string;
  }): Promise<Partner[]> {
    return this.prisma.partner.findMany({
      where: {
        verified: true,
        availability: true,
        categoryId: input.categoryId,
        zones: { some: { zoneId: input.zoneId } },
      },
      orderBy: [{ rating: 'desc' }, { totalJobs: 'desc' }, { createdAt: 'asc' }],
      take: 10,
    });
  }

  private async failDispatch(bookingId: string, reason: string): Promise<DispatchResult> {
    await this.prisma.bookingStatusHistory.create({
      data: {
        bookingId,
        toStatus: BookingStatus.PENDING,
        reason: `dispatch_failed:${reason}`,
      },
    });
    this.events.emit(DISPATCH_EVENTS.BOOKING_DISPATCH_FAILED, { bookingId, reason });
    return { partnerId: null, reason };
  }
}
