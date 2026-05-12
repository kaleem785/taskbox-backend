import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CommissionQueryDto,
  GenerateWeekDto,
  RejectCommissionDto,
  SubmitCommissionDto,
  UpdateSettingsDto,
} from './dto/commission.dto';
import { PaymentsService } from './payments.service';

@ApiBearerAuth()
@ApiTags('payments')
@Roles(Role.ADMIN)
@Controller('commissions')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('settings')
  getSettings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.service.updateSettings(dto);
  }

  @Get()
  list(@Query() query: CommissionQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Partner submits payment proof (admin uses on partner’s behalf in v1)',
  })
  submit(@Param('id') id: string, @Body() dto: SubmitCommissionDto) {
    return this.service.submit(id, dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user.id);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectCommissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user.id);
  }

  @Post(':id/send-warning/:level')
  sendWarning(
    @Param('id') id: string,
    @Param('level') level: '1' | '2',
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.sendWarning(id, level === '2' ? 2 : 1, user.id);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.suspend(id, user.id);
  }

  @Post(':id/pay-fine')
  payFine(@Param('id') id: string) {
    return this.service.payFine(id);
  }

  @Post(':id/request-unsuspension')
  requestUnsuspension(@Param('id') id: string) {
    return this.service.requestUnsuspension(id);
  }

  @Post(':id/approve-unsuspension')
  approveUnsuspension(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveUnsuspension(id, user.id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Manually trigger weekly commission generation' })
  generate(@Body() dto: GenerateWeekDto) {
    return this.service.generateForWeek(dto);
  }

  @Post('deadline-sweep')
  @ApiOperation({ summary: 'Manually trigger the hourly deadline-escalation sweep' })
  deadlineSweep() {
    return this.service.runDeadlineSweep();
  }
}
