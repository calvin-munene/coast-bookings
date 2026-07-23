import type { BookingStatus, BookingTransitionContext } from "./types";

const transitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  DRAFT: ["PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "CANCELLED_BY_GUEST"],
  PENDING_HOST_APPROVAL: ["AWAITING_PAYMENT", "HOST_DECLINED", "CANCELLED_BY_GUEST"],
  AWAITING_PAYMENT: ["PAYMENT_PROCESSING", "PAYMENT_FAILED", "CANCELLED_BY_GUEST", "CANCELLED_BY_ADMIN"],
  PAYMENT_PROCESSING: ["CONFIRMED", "PAYMENT_FAILED", "PAYMENT_REVIEW", "CANCELLED_BY_ADMIN"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED_BY_GUEST", "CANCELLED_BY_HOST", "CANCELLED_BY_ADMIN", "NO_SHOW", "DISPUTED"],
  HOST_DECLINED: [],
  PAYMENT_FAILED: ["AWAITING_PAYMENT", "CANCELLED_BY_GUEST", "CANCELLED_BY_ADMIN"],
  CANCELLED_BY_GUEST: ["REFUNDED", "PARTIALLY_REFUNDED"],
  CANCELLED_BY_HOST: ["REFUNDED", "PARTIALLY_REFUNDED"],
  CANCELLED_BY_ADMIN: ["REFUNDED", "PARTIALLY_REFUNDED"],
  CHECKED_IN: ["CHECKED_OUT", "DISPUTED"],
  CHECKED_OUT: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED", "PARTIALLY_REFUNDED", "REFUNDED"],
  NO_SHOW: ["COMPLETED", "DISPUTED", "PARTIALLY_REFUNDED"],
  DISPUTED: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED_BY_ADMIN"],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ["REFUNDED", "COMPLETED"],
  PAYMENT_REVIEW: ["CONFIRMED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED_BY_ADMIN"],
};

export class InvalidBookingTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Booking cannot transition from ${from} to ${to}`);
    this.name = "InvalidBookingTransitionError";
  }
}

export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
  context: BookingTransitionContext,
): void {
  if (!transitions[from].includes(to)) throw new InvalidBookingTransitionError(from, to);
  if (to === "CONFIRMED" && !context.paymentVerified) {
    throw new Error("A booking cannot be confirmed without verified payment");
  }
  if (context.disputeOpen && to === "COMPLETED") {
    throw new Error("A disputed booking cannot complete until the dispute is resolved");
  }
  if (to.startsWith("CANCELLED") && !context.reason?.trim()) {
    throw new Error("Cancellation transitions require a reason");
  }
}

export function allowedBookingTransitions(status: BookingStatus): readonly BookingStatus[] {
  return transitions[status];
}
