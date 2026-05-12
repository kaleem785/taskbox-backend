import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BookingStatus,
  Commission,
  CommissionEventKind,
  CommissionSettings,
  CommissionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import {
  CommissionQueryDto,
  GenerateWeekDto,
  RejectCommissionDto,
  SubmitCommissionDto,
  UpdateSettingsDto,
} from './dto/commission.dto';

export const COMMISSION_EVENTS = {
  GENERATED: 'commission.generated',
  SUBMITTED: 'commission.submitted',
  APPROVED: 'commission.approved',
  REJECTED: 'commission.rejected',
  WARNING_1: 'commission.warning1',
  WARNING_2: 'commission.warning2',
  SUSPENDED: 'commission.suspended',
  FINE_PAID: 'commission.fine_paid',
  UNSUSPENSION_REQUESTED: 'commission.unsuspension_requested',
  UNSUSPENSION_APPROVED: 'commission.unsuspension_approved',
} as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly email: EmailService,
  ) {}

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings(): Promise<CommissionSettings> {
    return this.prisma.commissionSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  updateSettings(input: UpdateSettingsDto): Promise<CommissionSettings> {
    return this.prisma.commissionSettings.upsert({
      where: { id: 'singleton' },
      update: input,
      create: { id: 'singleton', ...input },
    });
  }

  // ── Listing & detail ──────────────────────────────────────────────────────

  list(query: CommissionQueryDto) {
    const where: Prisma.CommissionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(query.week ? { weekStart: new Date(query.week) } : {}),
    };
    return this.prisma.commission.findMany({
      where,
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            category: { select: { name: true } },
          },
        },
        _count: { select: { jobs: true } },
      },
    });
  }

  async get(id: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      include: {
        partner: true,
        jobs: { orderBy: { date: 'asc' } },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    return commission;
  }

  // ── Submission & review ───────────────────────────────────────────────────

  async submit(id: string, input: SubmitCommissionDto): Promise<Commission> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.commission.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Commission not found');
      if (
        current.status !== CommissionStatus.PENDING &&
        current.status !== CommissionStatus.WARNING_1 &&
        current.status !== CommissionStatus.WARNING_2
      ) {
        throw new BadRequestException(
          `Cannot submit commission in status ${current.status}`,
        );
      }
      const updated = await tx.commission.update({
        where: { id },
        data: {
          status: CommissionStatus.SUBMITTED,
          submittedAt: new Date(),
          paymentMethod: input.paymentMethod,
          paymentRef: input.paymentRef,
          screenshotKey: input.screenshotKey,
        },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: id,
          kind: CommissionEventKind.SUBMITTED,
          detail: `Paid via ${input.paymentMethod} (${input.paymentRef})`,
        },
      });
      this.events.emit(COMMISSION_EVENTS.SUBMITTED, { commissionId: id });
      return updated;
    });
  }

  async approve(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.commission.findUnique({ where: { id } });
      if (!c) throw new NotFoundException('Commission not found');
      if (
        c.status !== CommissionStatus.SUBMITTED &&
        c.status !== CommissionStatus.UNDER_REVIEW
      ) {
        throw new BadRequestException(`Cannot approve in status ${c.status}`);
      }
      const updated = await tx.commission.update({
        where: { id },
        data: {
          status: CommissionStatus.CLEARED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: id,
          kind: CommissionEventKind.APPROVED,
          byUserId: userId,
        },
      });
      this.events.emit(COMMISSION_EVENTS.APPROVED, { commissionId: id });
      return updated;
    });
  }

  async reject(id: string, input: RejectCommissionDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.commission.findUnique({ where: { id } });
      if (!c) throw new NotFoundException('Commission not found');
      const updated = await tx.commission.update({
        where: { id },
        data: {
          status: CommissionStatus.PENDING,
          submittedAt: null,
          paymentMethod: null,
          paymentRef: null,
          screenshotKey: null,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: id,
          kind: CommissionEventKind.REJECTED,
          byUserId: userId,
          detail: input.reason,
        },
      });
      this.events.emit(COMMISSION_EVENTS.REJECTED, {
        commissionId: id,
        reason: input.reason,
      });
      return updated;
    });
  }

  async sendWarning(id: string, level: 1 | 2, userId?: string) {
    const c = await this.prisma.commission.findUnique({
      where: { id },
      include: { partner: true },
    });
    if (!c) throw new NotFoundException('Commission not found');
    const targetStatus =
      level === 1 ? CommissionStatus.WARNING_1 : CommissionStatus.WARNING_2;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.commission.update({
        where: { id },
        data: {
          status: targetStatus,
          ...(level === 1 ? { warning1At: new Date() } : { warning2At: new Date() }),
        },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: id,
          kind: level === 1
            ? CommissionEventKind.WARNING_1
            : CommissionEventKind.WARNING_2,
          byUserId: userId,
        },
      });
      return u;
    });
    this.events.emit(
      level === 1 ? COMMISSION_EVENTS.WARNING_1 : COMMISSION_EVENTS.WARNING_2,
      { commissionId: id, partnerId: c.partnerId },
    );
    if (c.partner.email) {
      await this.email.send(
        c.partner.email,
        `TaskBox commission overdue — Warning ${level}`,
        `<p>Hi ${escapeHtml(c.partner.name)},</p>
         <p>Your weekly commission of Rs ${c.commissionDue.toString()} is overdue.</p>
         <p>Submit payment proof within the deadline to avoid suspension.</p>`,
      );
    }
    return updated;
  }

  async suspend(id: string, userId?: string) {
    const settings = await this.getSettings();
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.commission.findUnique({
        where: { id },
        include: { partner: true },
      });
      if (!c) throw new NotFoundException('Commission not found');

      const due = Number(c.commissionDue);
      const percentFine = (due * Number(settings.penaltyPercentage)) / 100;
      const fine = Math.min(
        Number(settings.penaltyFineFixed),
        percentFine,
        Number(settings.maxFineCap),
      );

      const updated = await tx.commission.update({
        where: { id },
        data: {
          status: CommissionStatus.SUSPENDED,
          suspendedAt: new Date(),
          penaltyFine: new Prisma.Decimal(fine.toFixed(2)),
        },
      });
      await tx.partner.update({
        where: { id: c.partnerId },
        data: { availability: false },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: id,
          kind: CommissionEventKind.SUSPENDED,
          byUserId: userId,
          meta: { fine },
        },
      });
      this.events.emit(COMMISSION_EVENTS.SUSPENDED, {
        commissionId: id,
        partnerId: c.partnerId,
        fine,
      });
      return updated;
    });
  }

  async payFine(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.commission.update({
        where: { id },
        data: { finePaid: true },
      });
      await tx.commissionEvent.create({
        data: { commissionId: id, kind: CommissionEventKind.FINE_PAID },
      });
      this.events.emit(COMMISSION_EVENTS.FINE_PAID, { commissionId: id });
      return c;
    });
  }

  async requestUnsuspension(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.commission.update({
        where: { id },
        data: { status: CommissionStatus.UNSUSPENSION_REQUESTED },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: id,
          kind: CommissionEventKind.UNSUSPENSION_REQUESTED,
        },
      });
      this.events.emit(COMMISSION_EVENTS.UNSUSPENSION_REQUESTED, {
        commissionId: id,
      });
      return c;
    });
  }

  async approveUnsuspension(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.commission.update({
        where: { id },
        data: {
          status: CommissionStatus.CLEARED,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });
      await tx.partner.update({
        where: { id: c.partnerId },
        data: { availability: true },
      });
      await tx.commissionEvent.create({
        data: {
          commissionId: id,
          kind: CommissionEventKind.UNSUSPENSION_APPROVED,
          byUserId: userId,
        },
      });
      this.events.emit(COMMISSION_EVENTS.UNSUSPENSION_APPROVED, {
        commissionId: id,
        partnerId: c.partnerId,
      });
      return c;
    });
  }

  // ── Weekly generation ─────────────────────────────────────────────────────

  /**
   * Generate one Commission row per partner who had COMPLETED bookings in the
   * given week. Idempotent: re-runs update existing rows in-place by upsert.
   */
  async generateForWeek(input: GenerateWeekDto): Promise<{ generated: number }> {
    const weekStart = startOfWeekUTC(new Date(input.weekStart));
    const weekEnd = endOfWeekUTC(weekStart);
    const settings = await this.getSettings();
    const deadline = computeDeadline(weekEnd, settings);

    // Group completed bookings by partner
    const groups = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        partnerId: { not: null },
        scheduledDate: { gte: weekStart, lte: weekEnd },
      },
      include: {
        partner: { include: { category: { select: { slug: true } } } },
        service: { select: { name: true } },
      },
    });

    const byPartner = new Map<
      string,
      { partnerId: string; total: number; rows: typeof groups }
    >();
    for (const b of groups) {
      if (!b.partnerId) continue;
      const existing = byPartner.get(b.partnerId) ?? {
        partnerId: b.partnerId,
        total: 0,
        rows: [],
      };
      existing.total += Number(b.amount);
      existing.rows.push(b);
      byPartner.set(b.partnerId, existing);
    }

    let generated = 0;
    const categoryRates = (settings.categoryRates as Record<string, number>) ?? {};

    for (const { partnerId, total, rows } of byPartner.values()) {
      const partner = rows[0].partner!;
      const slug = partner.category?.slug ?? '';
      const rate = categoryRates[slug] ?? Number(settings.defaultRatePercent);
      const due = (total * rate) / 100;

      const commission = await this.prisma.commission.upsert({
        where: { partnerId_weekStart: { partnerId, weekStart } },
        update: {
          weekEnd,
          jobsCount: rows.length,
          cashCollected: new Prisma.Decimal(total.toFixed(2)),
          commissionRate: new Prisma.Decimal(rate.toFixed(2)),
          commissionDue: new Prisma.Decimal(due.toFixed(2)),
          deadline,
        },
        create: {
          partnerId,
          weekStart,
          weekEnd,
          jobsCount: rows.length,
          cashCollected: new Prisma.Decimal(total.toFixed(2)),
          commissionRate: new Prisma.Decimal(rate.toFixed(2)),
          commissionDue: new Prisma.Decimal(due.toFixed(2)),
          deadline,
        },
      });

      // Refresh job rows
      await this.prisma.commissionJob.deleteMany({
        where: { commissionId: commission.id },
      });
      await this.prisma.commissionJob.createMany({
        data: rows.map((b) => ({
          commissionId: commission.id,
          bookingId: b.id,
          date: b.scheduledDate,
          jobName: b.service.name,
          customerPaid: b.amount,
          commission: new Prisma.Decimal(
            ((Number(b.amount) * rate) / 100).toFixed(2),
          ),
        })),
        skipDuplicates: true,
      });
      await this.prisma.commissionEvent.create({
        data: {
          commissionId: commission.id,
          kind: CommissionEventKind.GENERATED,
          meta: { rate, jobsCount: rows.length },
        },
      });

      generated++;
      this.events.emit(COMMISSION_EVENTS.GENERATED, {
        commissionId: commission.id,
        partnerId,
      });
    }
    return { generated };
  }

  /**
   * Hourly deadline scan — auto-escalate PENDING commissions past their deadline.
   * Returns counts for each action performed.
   */
  async runDeadlineSweep(now: Date = new Date()) {
    const settings = await this.getSettings();
    const overdue = await this.prisma.commission.findMany({
      where: {
        status: {
          in: [CommissionStatus.PENDING, CommissionStatus.WARNING_1, CommissionStatus.WARNING_2],
        },
        deadline: { lt: now },
      },
      include: { partner: true },
    });

    let warned1 = 0;
    let warned2 = 0;
    let suspended = 0;
    for (const c of overdue) {
      const hoursOverdue = (now.getTime() - c.deadline.getTime()) / (60 * 60 * 1000);

      if (
        hoursOverdue >= settings.suspensionHours &&
        settings.autoSuspensionEnabled &&
        c.status !== CommissionStatus.SUSPENDED
      ) {
        await this.suspend(c.id);
        suspended++;
      } else if (
        hoursOverdue >= settings.warning2Hours &&
        c.status === CommissionStatus.WARNING_1
      ) {
        await this.sendWarning(c.id, 2);
        warned2++;
      } else if (
        hoursOverdue >= settings.warning1Hours &&
        c.status === CommissionStatus.PENDING
      ) {
        await this.sendWarning(c.id, 1);
        warned1++;
      }
    }

    this.logger.log(
      { warned1, warned2, suspended, scanned: overdue.length },
      'Deadline sweep complete',
    );
    return { scanned: overdue.length, warned1, warned2, suspended };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay() || 7; // Sun=0 → 7
  const r = new Date(d);
  if (day !== 1) r.setUTCDate(d.getUTCDate() - (day - 1));
  r.setUTCHours(0, 0, 0, 0);
  return r;
}
function endOfWeekUTC(weekStart: Date): Date {
  const r = new Date(weekStart);
  r.setUTCDate(weekStart.getUTCDate() + 6);
  r.setUTCHours(23, 59, 59, 999);
  return r;
}
function computeDeadline(weekEnd: Date, settings: CommissionSettings): Date {
  // weekEnd is Sunday; deadlineDayOfWeek defaults 6 (Saturday). Anchor to that day
  // within the same calendar week.
  const r = new Date(weekEnd);
  const target = settings.deadlineDayOfWeek; // 0=Sun … 6=Sat
  // Move from Sunday (weekEnd day=0 when end-of-week is Sunday) back to target
  const dayDiff = (r.getUTCDay() - target + 7) % 7;
  r.setUTCDate(r.getUTCDate() - dayDiff);
  r.setUTCHours(settings.deadlineHourLocal, settings.deadlineMinuteLocal, 0, 0);
  return r;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
