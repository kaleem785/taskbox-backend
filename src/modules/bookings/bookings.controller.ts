import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../prisma/client';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BookingQueryDto } from './dto/booking-query.dto';
import { BookingsService } from './bookings.service';
import {
  CancelBookingDto,
  CreateBookingDto,
  ReassignBookingDto,
  TransitionStatusDto,
  UpdateBookingDto,
  UpdatePaymentStatusDto,
} from './dto/booking.dto';

@ApiBearerAuth()
@ApiTags('bookings')
@Roles(Role.ADMIN)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@Query() q: BookingQueryDto) {
    return this.bookings.list({
      page: q.page,
      limit: q.limit,
      search: q.search,
      status: q.status,
      customerId: q.customerId,
      partnerId: q.partnerId,
      cityId: q.cityId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bookings.get(id);
  }

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookings.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookings.update(id, dto);
  }

  @Post(':id/reassign')
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.reassign(id, dto.partnerId, user.id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.cancel(id, dto, user.id);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: TransitionStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookings.changeStatus(id, dto, user.id);
  }

  @Patch(':id/payment')
  updatePayment(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.bookings.updatePayment(id, dto);
  }
}
