import { Module } from '@nestjs/common';
import { DispatchGateway } from './dispatch.gateway';
import { VerificationGateway } from './verification.gateway';

@Module({
  providers: [VerificationGateway, DispatchGateway],
})
export class RealtimeModule {}
