import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiBearerAuth()
@ApiTags('dashboard')
@Roles(Role.ADMIN, Role.EXAMINER)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats() {
    return this.dashboard.stats();
  }

  @Get('bookings-chart')
  bookingsChart(@Query('days') days?: string) {
    return this.dashboard.bookingsChart(days ? Math.max(1, Math.min(180, +days)) : 30);
  }

  @Get('service-breakdown')
  serviceBreakdown() {
    return this.dashboard.serviceBreakdown();
  }

  @Get('top-partners')
  topPartners(@Query('limit') limit?: string) {
    return this.dashboard.topPartners(limit ? Math.max(1, Math.min(50, +limit)) : 5);
  }

  @Get('live-dispatch')
  liveDispatch() {
    return this.dashboard.liveDispatch();
  }

  @Get('overdue-commissions')
  overdueCommissions() {
    return this.dashboard.overdueCommissions();
  }
}
