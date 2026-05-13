import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActivityEntityType,
  Applicant,
  ApplicantStatus,
  DocumentStatus,
  DocumentType,
  Prisma,
} from '../../prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { canTransition } from './state-machine';
import type {
  ApproveApplicantDto,
  CreateApplicantDto,
  RejectApplicantDto,
  RequestChangesDto,
  ScheduleTestDto,
  ScoreTestDto,
  UpdateApplicantDto,
  UpdateDocumentDto,
} from './dto/applicant.dto';

interface Actor {
  id?: string;
  name?: string;
}

export const VERIFICATION_EVENTS = {
  APPLICANT_CREATED: 'applicant.created',
  APPLICANT_UPDATED: 'applicant.updated',
  APPLICANT_APPROVED: 'applicant.approved',
  APPLICANT_REJECTED: 'applicant.rejected',
  APPLICANT_CHANGES_REQUESTED: 'applicant.changesRequested',
  APPLICANT_TEST_SCHEDULED: 'applicant.testScheduled',
  APPLICANT_TEST_SCORED: 'applicant.testScored',
} as const;

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Listing & detail ──────────────────────────────────────────────────────

  list(filter: { status?: ApplicantStatus; categoryId?: string; cityId?: string }) {
    const where: Prisma.ApplicantWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.cityId ? { cityId: filter.cityId } : {}),
    };
    return this.prisma.applicant.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
    });
  }

  async get(id: string) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        documents: { orderBy: { type: 'asc' } },
        test: true,
      },
    });
    if (!applicant) throw new NotFoundException('Applicant not found');
    const activityLog = await this.prisma.activityLog.findMany({
      where: { entityType: 'APPLICANT', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { ...applicant, activityLog };
  }

  // ── Create & update ───────────────────────────────────────────────────────

  async create(input: CreateApplicantDto, actor: Actor): Promise<Applicant> {
    const applicant = await this.prisma.$transaction(async (tx) => {
      const a = await tx.applicant.create({ data: input });
      // Seed one document row per type (all MISSING)
      await tx.applicantDocument.createMany({
        data: Object.values(DocumentType).map((type) => ({
          applicantId: a.id,
          type,
          status: DocumentStatus.MISSING,
        })),
      });
      await tx.activityLog.create({
        data: {
          entityType: ActivityEntityType.APPLICANT,
          entityId: a.id,
          event: 'application.created',
          detail: `Application opened for ${a.name}`,
          actorUserId: actor.id,
          actorName: actor.name,
          color: '#1E88E5',
        },
      });
      return a;
    });
    this.events.emit(VERIFICATION_EVENTS.APPLICANT_CREATED, { applicant });
    return applicant;
  }

  update(id: string, input: UpdateApplicantDto): Promise<Applicant> {
    return this.prisma.applicant.update({ where: { id }, data: input });
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  async updateDocument(
    applicantId: string,
    type: DocumentType,
    input: UpdateDocumentDto,
    actor: Actor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.applicantDocument.update({
        where: { applicantId_type: { applicantId, type } },
        data: {
          ...(input.fileKey ? { fileKey: input.fileKey, uploadedAt: new Date() } : {}),
          ...(input.status ? { status: input.status, reviewedAt: new Date() } : input.fileKey ? { status: DocumentStatus.UPLOADED } : {}),
          ...(input.feedback ? { feedback: input.feedback } : {}),
        },
      });
      // Promote to DOCS_REVIEW once anything is uploaded
      const applicant = await tx.applicant.findUnique({ where: { id: applicantId } });
      if (!applicant) throw new NotFoundException('Applicant not found');
      if (
        applicant.status === ApplicantStatus.PENDING &&
        input.fileKey
      ) {
        await tx.applicant.update({
          where: { id: applicantId },
          data: { status: ApplicantStatus.DOCS_REVIEW },
        });
      }
      await tx.activityLog.create({
        data: {
          entityType: ActivityEntityType.APPLICANT,
          entityId: applicantId,
          event: input.status === DocumentStatus.VALID
            ? 'document.approved'
            : input.status === DocumentStatus.NEEDS_FIX
            ? 'document.needsFix'
            : input.fileKey ? 'document.uploaded' : 'document.updated',
          detail: `${type}: ${input.status ?? (input.fileKey ? 'uploaded' : 'updated')}`,
          actorUserId: actor.id,
          actorName: actor.name,
          color: input.status === DocumentStatus.VALID ? '#00C853' : '#FFA726',
        },
      });
      this.events.emit(VERIFICATION_EVENTS.APPLICANT_UPDATED, { applicantId });
      return doc;
    });
  }

  // ── State transitions ─────────────────────────────────────────────────────

  async requestChanges(id: string, input: RequestChangesDto, actor: Actor) {
    await this.transition(id, ApplicantStatus.NEEDS_REVIEW, {
      event: 'application.changesRequested',
      detail: input.feedback,
      actor,
      color: '#FFA726',
      extra: { reviewCount: { increment: 1 } },
    });
    this.events.emit(VERIFICATION_EVENTS.APPLICANT_CHANGES_REQUESTED, {
      applicantId: id,
      feedback: input.feedback,
    });
    return this.get(id);
  }

  async scheduleTest(id: string, input: ScheduleTestDto, actor: Actor) {
    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO date');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.applicantTest.upsert({
        where: { applicantId: id },
        create: {
          applicantId: id,
          scheduledAt,
          venueName: input.venueName,
          scheduledByUserId: actor.id,
        },
        update: {
          scheduledAt,
          venueName: input.venueName,
          scheduledByUserId: actor.id,
        },
      });
    });
    await this.transition(id, ApplicantStatus.TEST_SCHEDULED, {
      event: 'test.scheduled',
      detail: `Test scheduled for ${scheduledAt.toISOString()}${input.venueName ? ' at ' + input.venueName : ''}`,
      actor,
      color: '#42A5F5',
    });
    this.events.emit(VERIFICATION_EVENTS.APPLICANT_TEST_SCHEDULED, {
      applicantId: id,
      scheduledAt,
    });
    return this.get(id);
  }

  async scoreTest(id: string, input: ScoreTestDto, actor: Actor) {
    const total =
      (input.scoreSafety ?? 0) +
      (input.scoreTools ?? 0) +
      (input.scorePractical ?? 0) +
      (input.scoreCustomer ?? 0) +
      (input.scoreDocs ?? 0);
    const passed = input.attended && total >= 70;

    await this.prisma.applicantTest.update({
      where: { applicantId: id },
      data: {
        attended: input.attended,
        scoreSafety: input.scoreSafety,
        scoreTools: input.scoreTools,
        scorePractical: input.scorePractical,
        scoreCustomer: input.scoreCustomer,
        scoreDocs: input.scoreDocs,
        totalScore: total,
        passed,
        notes: input.notes,
        scoredAt: new Date(),
        scoredByUserId: actor.id,
      },
    });

    if (passed) {
      await this.transition(id, ApplicantStatus.TEST_COMPLETED, {
        event: 'test.passed',
        detail: `Score ${total}/100`,
        actor,
        color: '#00C853',
      });
      // Auto-advance to FINAL_APPROVAL queue
      await this.transition(id, ApplicantStatus.FINAL_APPROVAL, {
        event: 'finalApproval.queued',
        detail: 'Awaiting admin final approval',
        actor,
        color: '#1E88E5',
      });
    } else {
      await this.transition(id, ApplicantStatus.TEST_COMPLETED, {
        event: 'test.failed',
        detail: input.attended ? `Score ${total}/100 below pass mark` : 'Absent',
        actor,
        color: '#E53935',
      });
    }
    this.events.emit(VERIFICATION_EVENTS.APPLICANT_TEST_SCORED, {
      applicantId: id,
      totalScore: total,
      passed,
    });
    return this.get(id);
  }

  async approve(id: string, input: ApproveApplicantDto, actor: Actor) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!applicant) throw new NotFoundException('Applicant not found');
    if (
      applicant.status !== ApplicantStatus.FINAL_APPROVAL &&
      applicant.status !== ApplicantStatus.TEST_COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot approve from status ${applicant.status}`,
      );
    }

    const partner = await this.prisma.$transaction(async (tx) => {
      const p = await tx.partner.create({
        data: {
          name: applicant.name,
          phone: applicant.phone,
          email: applicant.email,
          categoryId: applicant.categoryId,
          cityId: applicant.cityId,
          verified: true,
          availability: true,
          tier: input.tier,
          zones: { create: input.zoneIds.map((zoneId) => ({ zoneId })) },
        },
      });
      await tx.applicant.update({
        where: { id },
        data: {
          status: ApplicantStatus.APPROVED,
          approvedAt: new Date(),
          profileCompletion: 100,
        },
      });
      await tx.activityLog.create({
        data: {
          entityType: ActivityEntityType.APPLICANT,
          entityId: id,
          event: 'application.approved',
          detail: `Approved · ${input.zoneIds.length} zones · tier ${input.tier ?? 'Standard'}`,
          actorUserId: actor.id,
          actorName: actor.name,
          color: '#00C853',
          meta: { zoneIds: input.zoneIds, partnerId: p.id, tier: input.tier },
        },
      });
      return p;
    });

    this.events.emit(VERIFICATION_EVENTS.APPLICANT_APPROVED, {
      applicantId: id,
      partnerId: partner.id,
    });
    return { applicant: await this.get(id), partner };
  }

  async reject(id: string, input: RejectApplicantDto, actor: Actor) {
    await this.transition(id, ApplicantStatus.REJECTED, {
      event: 'application.rejected',
      detail: input.reason,
      actor,
      color: '#E53935',
      extra: { rejectedAt: new Date(), rejectionReason: input.reason },
    });
    this.events.emit(VERIFICATION_EVENTS.APPLICANT_REJECTED, {
      applicantId: id,
      reason: input.reason,
    });
    return this.get(id);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async transition(
    id: string,
    to: ApplicantStatus,
    log: {
      event: string;
      detail: string;
      actor: Actor;
      color?: string;
      extra?: Prisma.ApplicantUpdateInput;
    },
  ): Promise<Applicant> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.applicant.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Applicant not found');
      if (current.status !== to && !canTransition(current.status, to)) {
        throw new BadRequestException(
          `Invalid transition: ${current.status} → ${to}`,
        );
      }
      const updated = await tx.applicant.update({
        where: { id },
        data: { status: to, ...(log.extra ?? {}) },
      });
      await tx.activityLog.create({
        data: {
          entityType: ActivityEntityType.APPLICANT,
          entityId: id,
          event: log.event,
          detail: log.detail,
          actorUserId: log.actor.id,
          actorName: log.actor.name,
          color: log.color,
        },
      });
      return updated;
    });
  }
}
