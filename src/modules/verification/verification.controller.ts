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
import { DocumentType, Role } from '../../prisma/client';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApplicantQueryDto,
  ApproveApplicantDto,
  CreateApplicantDto,
  RejectApplicantDto,
  RequestChangesDto,
  ScheduleTestDto,
  ScoreTestDto,
  UpdateApplicantDto,
  UpdateDocumentDto,
} from './dto/applicant.dto';
import { VerificationService } from './verification.service';

@ApiBearerAuth()
@ApiTags('verification')
@Roles(Role.ADMIN, Role.EXAMINER)
@Controller('verification/applicants')
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get()
  list(@Query() query: ApplicantQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateApplicantDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, { id: user.id, name: user.email });
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateApplicantDto) {
    return this.service.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/documents/:type')
  updateDocument(
    @Param('id') id: string,
    @Param('type') type: DocumentType,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateDocument(id, type, dto, {
      id: user.id,
      name: user.email,
    });
  }

  @Roles(Role.ADMIN)
  @Post(':id/request-changes')
  requestChanges(
    @Param('id') id: string,
    @Body() dto: RequestChangesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestChanges(id, dto, { id: user.id, name: user.email });
  }

  @Roles(Role.ADMIN)
  @Post(':id/schedule-test')
  scheduleTest(
    @Param('id') id: string,
    @Body() dto: ScheduleTestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.scheduleTest(id, dto, { id: user.id, name: user.email });
  }

  @Roles(Role.ADMIN, Role.EXAMINER)
  @Post(':id/score-test')
  scoreTest(
    @Param('id') id: string,
    @Body() dto: ScoreTestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.scoreTest(id, dto, { id: user.id, name: user.email });
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveApplicantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.approve(id, dto, { id: user.id, name: user.email });
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectApplicantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, { id: user.id, name: user.email });
  }
}
