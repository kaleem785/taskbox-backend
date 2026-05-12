import { BookingStatus } from '@prisma/client';

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: [BookingStatus.AUTO_ASSIGNED, BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  AUTO_ASSIGNED: [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.CANCELLED],
  CONFIRMED: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  IN_PROGRESS: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function canBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}
