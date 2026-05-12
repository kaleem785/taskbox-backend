import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PaymentsModule } from '../payments/payments.module';
import { CommissionCronService } from './commission-cron.service';

export const COMMISSION_GENERATION_QUEUE = 'commission-generation';
export const COMMISSION_DEADLINE_QUEUE = 'commission-deadline';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url');
        if (!url) {
          // BullMQ requires a connection; in dev without redis we still mount
          // the module but workers will fail to connect — logged at runtime.
          return { connection: { host: 'localhost', port: 6379 } };
        }
        return { connection: { url } };
      },
    }),
    BullModule.registerQueue(
      { name: COMMISSION_GENERATION_QUEUE },
      { name: COMMISSION_DEADLINE_QUEUE },
    ),
    PaymentsModule,
  ],
  providers: [CommissionCronService],
})
export class JobsModule {}
