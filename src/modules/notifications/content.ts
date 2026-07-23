export type NotificationContent = Readonly<{
  subject: string;
  text: string;
  actionPath: string;
}>;

export function renderNotification(
  eventType: string,
  payload: Readonly<Record<string, unknown>>,
): NotificationContent {
  const reference = typeof payload.reference === "string" ? payload.reference : "your booking";
  const content: Record<string, NotificationContent> = {
    BOOKING_AWAITING_PAYMENT: { subject: "Complete your Coast Bookings payment", text: `${reference} is reserved for a limited time. Complete the secure checkout to confirm it.`, actionPath: "/guest/payments" },
    BOOKING_REQUESTED: { subject: "Booking request received", text: `${reference} is awaiting the host's response. We will notify you as soon as it is accepted or declined.`, actionPath: "/guest/pending-requests" },
    BOOKING_CONFIRMED: { subject: "Your Coast Bookings stay is confirmed", text: `${reference} is confirmed. Your trip details and voucher are ready in your guest portal.`, actionPath: "/guest/upcoming-stays" },
    BOOKING_BALANCE_PAID: { subject: "Booking balance received", text: `The outstanding balance for ${reference} has been verified.`, actionPath: "/guest/payments" },
    BOOKING_PART_PAYMENT_RECEIVED: { subject: "Booking payment received", text: `A payment for ${reference} has been verified. Any remaining balance is shown in your portal.`, actionPath: "/guest/payments" },
    BOOKING_CANCELLED_BY_GUEST: { subject: "Booking cancellation recorded", text: `${reference} has been cancelled. Refund eligibility will be calculated from the saved booking policy.`, actionPath: "/guest/bookings" },
    GROUP_QUOTE_ACCEPTED: { subject: "Group quotation accepted", text: `${reference} has been converted to a booking and is awaiting its first payment.`, actionPath: "/guest/group-enquiries" },
    PROPERTY_PUBLISHED: { subject: "Your listing is live", text: "Your verified property is now visible in the Coast Bookings marketplace.", actionPath: "/host/properties" },
    PROPERTY_CHANGES_REQUESTED: { subject: "Listing changes requested", text: "The verification team has requested changes before your listing can be published.", actionPath: "/host/verification" },
    PAYMENT_DEADLINE_APPROACHING: { subject: "A booking payment is due soon", text: `${reference} has an upcoming payment deadline.`, actionPath: "/guest/payments" },
    PAYOUT_READY: { subject: "Host payout ready for review", text: `${reference} is eligible for finance approval.`, actionPath: "/host/payouts" },
    REVIEW_REQUESTED: { subject: "How was your stay?", text: `Share an honest review for ${reference}. Reviews are published under Coast Bookings moderation rules.`, actionPath: "/guest/reviews" },
  };

  return content[eventType] ?? {
    subject: "Coast Bookings update",
    text: `There is a new ${eventType.toLowerCase().replaceAll("_", " ")} update in your account.`,
    actionPath: "/guest/dashboard",
  };
}
