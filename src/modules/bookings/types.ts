export const bookingStatuses = [
  "DRAFT",
  "PENDING_HOST_APPROVAL",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "HOST_DECLINED",
  "PAYMENT_FAILED",
  "CANCELLED_BY_GUEST",
  "CANCELLED_BY_HOST",
  "CANCELLED_BY_ADMIN",
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "NO_SHOW",
  "DISPUTED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "PAYMENT_REVIEW",
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

export type BookingMode = "INSTANT" | "REQUEST_TO_BOOK" | "GROUP_QUOTE";

export type BookingTransitionContext = Readonly<{
  actor: "GUEST" | "HOST" | "STAFF" | "SYSTEM";
  paymentVerified?: boolean;
  disputeOpen?: boolean;
  reason?: string;
}>;
