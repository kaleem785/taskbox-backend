import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ZonesModule } from '../zones/zones.module';
import { ApplicationUploadGuard } from './application-upload.guard';
import { PartnerApplicationController } from './partner-application.controller';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [ZonesModule, JwtModule.register({})],
  controllers: [VerificationController, PartnerApplicationController],
  providers: [VerificationService, ApplicationUploadGuard],
  exports: [VerificationService],
})
export class VerificationModule {}
