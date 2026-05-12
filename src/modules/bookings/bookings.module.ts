import { Module } from '@nestjs/common';
import { DispatchService } from '../dispatch/dispatch.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, DispatchService],
  exports: [BookingsService, DispatchService],
})
export class BookingsModule {}
