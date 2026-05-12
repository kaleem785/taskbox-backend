import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { DISPATCH_EVENTS } from '../dispatch/dispatch.service';

const ADMIN_BOOKINGS_ROOM = 'admin:bookings';
const PARTNER_ROOM = (partnerId: string) => `partner:${partnerId}`;

/**
 * The /realtime namespace is shared with VerificationGateway — both gateways
 * receive the same connection. Dispatch events fan out to admin + partner rooms.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class DispatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DispatchGateway.name);

  handleConnection(client: Socket) {
    void client.join(ADMIN_BOOKINGS_ROOM);
  }

  handleDisconnect(_client: Socket) {
    // no-op
  }

  /** Partner mobile app calls `socket.emit('partner:identify', { partnerId })` */
  @SubscribeMessage('partner:identify')
  identifyPartner(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partnerId?: string },
  ) {
    if (!body?.partnerId) return { ok: false, error: 'partnerId required' };
    void client.join(PARTNER_ROOM(body.partnerId));
    return { ok: true, room: PARTNER_ROOM(body.partnerId) };
  }

  @OnEvent(DISPATCH_EVENTS.BOOKING_ASSIGNED)
  onAssigned(payload: { bookingId: string; partnerId: string }) {
    this.server?.to(ADMIN_BOOKINGS_ROOM).emit('booking.assigned', payload);
    if (payload.partnerId) {
      this.server?.to(PARTNER_ROOM(payload.partnerId)).emit('booking.offer', payload);
    }
  }

  @OnEvent(DISPATCH_EVENTS.BOOKING_DISPATCH_FAILED)
  onFailed(payload: unknown) {
    this.server?.to(ADMIN_BOOKINGS_ROOM).emit('booking.dispatch_failed', payload);
  }

  @OnEvent(DISPATCH_EVENTS.BOOKING_REASSIGNED)
  onReassigned(payload: { bookingId: string; partnerId: string }) {
    this.server?.to(ADMIN_BOOKINGS_ROOM).emit('booking.reassigned', payload);
    if (payload.partnerId) {
      this.server?.to(PARTNER_ROOM(payload.partnerId)).emit('booking.offer', payload);
    }
  }

  @OnEvent(DISPATCH_EVENTS.BOOKING_CANCELLED)
  onCancelled(payload: unknown) {
    this.server?.to(ADMIN_BOOKINGS_ROOM).emit('booking.cancelled', payload);
  }

  @OnEvent(DISPATCH_EVENTS.BOOKING_STATUS_CHANGED)
  onStatusChanged(payload: unknown) {
    this.server?.to(ADMIN_BOOKINGS_ROOM).emit('booking.status_changed', payload);
  }
}
