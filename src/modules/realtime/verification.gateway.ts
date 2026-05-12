import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { VERIFICATION_EVENTS } from '../verification/verification.service';

const ADMIN_ROOM = 'admin:verification';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class VerificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(VerificationGateway.name);

  handleConnection(client: Socket) {
    // For v1, treat any connection as admin (Phase 8 wires JWT auth on the WS handshake).
    void client.join(ADMIN_ROOM);
    this.logger.debug(`WS connect ${client.id} → ${ADMIN_ROOM}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS disconnect ${client.id}`);
  }

  @OnEvent(VERIFICATION_EVENTS.APPLICANT_CREATED)
  onCreated(payload: unknown) {
    this.server?.to(ADMIN_ROOM).emit('applicant.created', payload);
  }

  @OnEvent(VERIFICATION_EVENTS.APPLICANT_UPDATED)
  onUpdated(payload: unknown) {
    this.server?.to(ADMIN_ROOM).emit('applicant.updated', payload);
  }

  @OnEvent(VERIFICATION_EVENTS.APPLICANT_APPROVED)
  onApproved(payload: unknown) {
    this.server?.to(ADMIN_ROOM).emit('applicant.approved', payload);
  }

  @OnEvent(VERIFICATION_EVENTS.APPLICANT_REJECTED)
  onRejected(payload: unknown) {
    this.server?.to(ADMIN_ROOM).emit('applicant.rejected', payload);
  }

  @OnEvent(VERIFICATION_EVENTS.APPLICANT_CHANGES_REQUESTED)
  onChangesRequested(payload: unknown) {
    this.server?.to(ADMIN_ROOM).emit('applicant.changesRequested', payload);
  }

  @OnEvent(VERIFICATION_EVENTS.APPLICANT_TEST_SCHEDULED)
  onTestScheduled(payload: unknown) {
    this.server?.to(ADMIN_ROOM).emit('applicant.testScheduled', payload);
  }

  @OnEvent(VERIFICATION_EVENTS.APPLICANT_TEST_SCORED)
  onTestScored(payload: unknown) {
    this.server?.to(ADMIN_ROOM).emit('applicant.testScored', payload);
  }
}
