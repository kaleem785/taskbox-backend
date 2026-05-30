import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { DocumentType } from '../../prisma/client';
import { StorageService, UploadPurpose } from '../storage/storage.service';
import {
  APPLICATION_UPLOAD_SCOPE,
  ApplicationUploadGuard,
} from './application-upload.guard';
import { CreateApplicantDto } from './dto/applicant.dto';
import {
  AppPresignedUploadDto,
  AppUpdateDocumentDto,
} from './dto/partner-application.dto';
import { VerificationService } from './verification.service';

/** App-uploaded document type → storage purpose. Restricted to the
 *  `verification.*` set so a scoped token can only ever write applicant docs. */
const DOC_PURPOSE: Record<DocumentType, UploadPurpose> = {
  CNIC_FRONT: 'verification.cnicFront',
  CNIC_BACK: 'verification.cnicBack',
  SELFIE: 'verification.selfie',
  CERTIFICATE: 'verification.certificate',
  EXPERIENCE: 'verification.experience',
};

/**
 * Public, rate-limited partner-application surface for the mobile app. All
 * routes are `@Public()`; the document routes are additionally protected by the
 * short-lived scoped upload token (no admin auth, no open upload surface).
 */
@ApiTags('partner-application')
@Controller('partners/apply')
export class PartnerApplicationController {
  constructor(
    private readonly verification: VerificationService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  @ApiOperation({
    summary:
      'Submit a partner application from the app (PENDING; deduped by phone). Returns a scoped upload token.',
  })
  async apply(@Body() dto: CreateApplicantDto) {
    const applicant = await this.verification.applyFromApp(dto);
    const uploadToken = await this.jwt.signAsync(
      { applicantId: applicant.id, scope: APPLICATION_UPLOAD_SCOPE },
      {
        secret: this.config.get<string>('applicationUpload.secret'),
        expiresIn: this.config.get<string>('applicationUpload.ttl') ?? '30m',
      } as JwtSignOptions,
    );
    return { applicantId: applicant.id, uploadToken };
  }

  @Public()
  @UseGuards(ApplicationUploadGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/documents/presigned-url')
  @ApiOperation({
    summary: 'Request a presigned R2 upload URL for an applicant document (scoped token required)',
  })
  presignedUrl(@Param('id') id: string, @Body() dto: AppPresignedUploadDto) {
    // entityId is derived from the route param (already asserted to equal the
    // token's applicantId by the guard) — never from client-supplied data.
    return this.storage.getPresignedUploadUrl({
      purpose: DOC_PURPOSE[dto.type],
      entityId: id,
      mimeType: dto.mimeType,
      size: dto.size,
      filename: dto.filename,
    });
  }

  @Public()
  @UseGuards(ApplicationUploadGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Patch(':id/documents/:type')
  @ApiOperation({
    summary: 'Attach an uploaded document fileKey to the applicant (scoped token required)',
  })
  updateDocument(
    @Param('id') id: string,
    @Param('type') type: DocumentType,
    @Body() dto: AppUpdateDocumentDto,
  ) {
    return this.verification.updateDocument(id, type, { fileKey: dto.fileKey }, {
      name: 'Partner App',
    });
  }
}
