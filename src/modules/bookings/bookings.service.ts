import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssignedBy,
  BookingStatus,
  Prisma,
} from '../../prisma/client';

import { buildPaginatedMeta, Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { DISPATCH_EVENTS, DispatchService } from '../dispatch/dispatch.service';
import { canBookingTransition } from './booking-state-machine';
import {
  CancelBookingDto,
  CreateBookingDto,
  TransitionStatusDto,
  UpdateBookingDto,
  UpdatePaymentStatusDto,
} from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DispatchService,
    private readonly events: EventEmitter2,
  ) {}

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    status?: BookingStatus;
    customerId?: string;
    partnerId?: string;
    cityId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Paginated<unknown>> {
    const { page, limit, search, status, customerId, partnerId, cityId, dateFrom, dateTo } =
      params;
    const where: Prisma.BookingWhereInput = {
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(partnerId ? { partnerId } : {}),
      ...(cityId ? { customerAddress: { cityId } } : {}),
      ...(dateFrom || dateTo
        ? {
            scheduledDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { customer: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
              { customer: { phone: { contains: search } } },
              { partner: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          partner: { select: { id: true, name: true, phone: true, rating: true } },
          service: { select: { id: true, name: true, categoryId: true } },
          customerAddress: {
            select: {
              id: true,
              fullAddress: true,
              area: true,
              landmark: true,
              assignedZone: { select: { id: true, name: true } },
              city: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data: items, meta: buildPaginatedMeta(page, limit, total) };
  }

  async get(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        customerAddress: {
          include: {
            assignedZone: true,
            city: true,
          },
        },
        service: { include: { category: true } },
        partner: { include: { category: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async create(input: CreateBookingDto) {
    // Validate the address belongs to the customer
    const address = await this.prisma.customerAddress.findUnique({
      where: { id: input.customerAddressId },
    });
    if (!address || address.customerId !== input.customerId) {
      throw new BadRequestException('customerAddressId does not belong to customer');
    }

    // XOR invariant: exactly one of serviceVariantId / packageId. Backed by a
    // Postgres CHECK constraint (bookings_variant_xor_package) as a safety net.
    const hasVariant = Boolean(input.serviceVariantId);
    const hasPackage = Boolean(input.packageId);
    if (hasVariant === hasPackage) {
      throw new BadRequestException(
        'Provide exactly one of serviceVariantId or packageId',
      );
    }

    // Resolve the denormalized parent serviceId from whichever path was used.
    let serviceId: string;
    if (hasVariant) {
      const variant = await this.prisma.serviceVariant.findUnique({
        where: { id: input.serviceVariantId },
        select: { serviceId: true },
      });
      if (!variant) throw new NotFoundException('Service variant not found');
      serviceId = variant.serviceId;
    } else {
      const pkg = await this.prisma.package.findUnique({
        where: { id: input.packageId },
        select: { serviceId: true },
      });
      if (!pkg) throw new NotFoundException('Package not found');
      serviceId = pkg.serviceId;
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          customerId: input.customerId,
          customerAddressId: input.customerAddressId,
          serviceId,
          serviceVariantId: input.serviceVariantId ?? null,
          packageId: input.packageId ?? null,
          scheduledDate: new Date(input.scheduledDate),
          scheduledTime: input.scheduledTime,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          status: BookingStatus.PENDING,
        },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: b.id, toStatus: BookingStatus.PENDING, reason: 'created' },
      });
      return b;
    });

    // Fire auto-dispatch (synchronous so the response carries the assignment outcome)
    const result = await this.dispatch.dispatch(booking.id);
    return { booking: await this.get(booking.id), dispatch: result };
  }

  async update(id: string, input: UpdateBookingDto) {
    const data: Prisma.BookingUpdateInput = { ...input };
    if (input.scheduledDate) {
      data.scheduledDate = new Date(input.scheduledDate);
    }
    return this.prisma.booking.update({ where: { id }, data });
  }

  async reassign(id: string, partnerId: string, byUserId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');
    if (!partner.verified) {
      throw new BadRequestException('Cannot assign an unverified partner');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Booking not found');
      if (
        current.status !== BookingStatus.PENDING &&
        current.status !== BookingStatus.AUTO_ASSIGNED &&
        current.status !== BookingStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          `Cannot reassign in status ${current.status}`,
        );
      }
      const updated = await tx.booking.update({
        where: { id },
        data: {
          partnerId,
          status: BookingStatus.CONFIRMED,
          autoAssigned: false,
          assignedAt: new Date(),
          assignedBy: AssignedBy.ADMIN,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: current.status,
          toStatus: BookingStatus.CONFIRMED,
          reason: `reassigned to ${partner.name}`,
          byUserId,
        },
      });
      return updated;
    });

    this.events.emit(DISPATCH_EVENTS.BOOKING_REASSIGNED, {
      bookingId: id,
      partnerId,
      assignedBy: AssignedBy.ADMIN,
    });
    return result;
  }

  async cancel(id: string, input: CancelBookingDto, byUserId: string) {
    return this.transition(id, BookingStatus.CANCELLED, byUserId, {
      reason: `cancel:${input.reason}${input.detail ? `:${input.detail}` : ''}`,
      extra: {
        cancelReason: input.reason,
        cancelDetail: input.detail,
        cancelledByUserId: byUserId,
        cancelledAt: new Date(),
      },
    }).then((b) => {
      this.events.emit(DISPATCH_EVENTS.BOOKING_CANCELLED, {
        bookingId: id,
        reason: input.reason,
      });
      return b;
    });
  }

  changeStatus(id: string, input: TransitionStatusDto, byUserId: string) {
    return this.transition(id, input.status, byUserId).then((b) => {
      this.events.emit(DISPATCH_EVENTS.BOOKING_STATUS_CHANGED, {
        bookingId: id,
        toStatus: input.status,
      });
      return b;
    });
  }

  async updatePayment(id: string, input: UpdatePaymentStatusDto) {
    return this.prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: input.paymentStatus,
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      },
    });
  }

  // ── internal ─────────────────────────────────────────────────────────────

  private async transition(
    id: string,
    to: BookingStatus,
    byUserId: string,
    opts: { reason?: string; extra?: Prisma.BookingUpdateInput } = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Booking not found');
      if (current.status !== to && !canBookingTransition(current.status, to)) {
        throw new BadRequestException(
          `Invalid booking transition: ${current.status} → ${to}`,
        );
      }
      const updated = await tx.booking.update({
        where: { id },
        data: { status: to, ...(opts.extra ?? {}) },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: current.status,
          toStatus: to,
          reason: opts.reason,
          byUserId,
        },
      });
      return updated;
    });
  }
}
