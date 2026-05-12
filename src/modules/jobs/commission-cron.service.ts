import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PaymentsService } from '../payments/payments.service';

/**
 * Cron-driven runners — for v1 we use NestJS's in-process Schedule module
 * (single instance is fine on Railway). BullMQ remains wired up in JobsModule
 * for future job-queue work (email-send, booking-reminder fan-out).
 */
@Injectable()
export class CommissionCronService {
  private readonly logger = new Logger(CommissionCronService.name);

  constructor(private readonly payments: PaymentsService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'commission-deadline-sweep' })
  async deadlineSweep(): Promise<void> {
    try {
      const result = await this.payments.runDeadlineSweep();
      this.logger.log(result, 'commission-deadline cron complete');
    } catch (err) {
      this.logger.error({ err }, 'commission-deadline cron failed');
    }
  }

  /** Every Monday at 00:05 local time. */
  @Cron('5 0 * * 1', { name: 'commission-weekly-generation' })
  async weeklyGeneration(): Promise<void> {
    try {
      const today = new Date();
      // Generate for the PREVIOUS week
      const prev = new Date(today);
      prev.setUTCDate(today.getUTCDate() - 7);
      const result = await this.payments.generateForWeek({
        weekStart: prev.toISOString().slice(0, 10),
      });
      this.logger.log(result, 'weekly commission generation complete');
    } catch (err) {
      this.logger.error({ err }, 'weekly commission generation failed');
    }
  }
}
