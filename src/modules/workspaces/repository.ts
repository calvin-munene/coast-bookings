import "server-only";
import { and, count, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { bookings, groupEnquiries, hostOrganizations, payments, payouts, pricingSnapshots, supportTickets } from "@/db/schema";

export type WorkspaceSummary = readonly { label: string; value: string }[];
function money(minor: string | number | bigint | null): string { return `KES ${(Number(minor ?? 0) / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`; }

export async function guestWorkspaceSummary(userId: string): Promise<WorkspaceSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const [[upcoming], [pending], [balance]] = await Promise.all([
    getDb().select({ value: count() }).from(bookings).where(and(eq(bookings.guestUserId, userId), inArray(bookings.status, ["CONFIRMED", "CHECKED_IN"]), gte(bookings.checkOut, today))),
    getDb().select({ value: count() }).from(bookings).where(and(eq(bookings.guestUserId, userId), inArray(bookings.status, ["PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_PROCESSING"]))),
    getDb().select({ value: sql<string>`coalesce(sum(${pricingSnapshots.guestTotalMinor}), 0)` }).from(pricingSnapshots).innerJoin(bookings, eq(bookings.id, pricingSnapshots.bookingId)).where(and(eq(bookings.guestUserId, userId), ne(bookings.paymentStatus, "SUCCEEDED"))),
  ]);
  return [{ label: "Upcoming stays", value: String(upcoming?.value ?? 0) }, { label: "Pending requests", value: String(pending?.value ?? 0) }, { label: "Outstanding balance", value: money(balance?.value ?? 0) }, { label: "Workspace", value: "Protected" }];
}

export async function hostWorkspaceSummary(organizationId: string): Promise<WorkspaceSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const [[arrivals], [pending], [earnings], [pendingPayouts]] = await Promise.all([
    getDb().select({ value: count() }).from(bookings).where(and(eq(bookings.hostOrganizationId, organizationId), eq(bookings.checkIn, today), eq(bookings.status, "CONFIRMED"))),
    getDb().select({ value: count() }).from(bookings).where(and(eq(bookings.hostOrganizationId, organizationId), eq(bookings.status, "PENDING_HOST_APPROVAL"))),
    getDb().select({ value: sql<string>`coalesce(sum(${pricingSnapshots.hostEarningsMinor}), 0)` }).from(pricingSnapshots).innerJoin(bookings, eq(bookings.id, pricingSnapshots.bookingId)).where(and(eq(bookings.hostOrganizationId, organizationId), inArray(bookings.status, ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"]))),
    getDb().select({ value: sql<string>`coalesce(sum(${payouts.amountMinor}), 0)` }).from(payouts).where(and(eq(payouts.hostOrganizationId, organizationId), inArray(payouts.status, ["PENDING", "ON_HOLD", "APPROVED", "PROCESSING"]))),
  ]);
  return [{ label: "Today's arrivals", value: String(arrivals?.value ?? 0) }, { label: "Pending requests", value: String(pending?.value ?? 0) }, { label: "Expected earnings", value: money(earnings?.value ?? 0) }, { label: "Pending payouts", value: money(pendingPayouts?.value ?? 0) }];
}

export async function operationsWorkspaceSummary(): Promise<WorkspaceSummary> {
  const [[enquiries], [paymentExceptions], [hostApprovals], [openIncidents]] = await Promise.all([
    getDb().select({ value: count() }).from(groupEnquiries).where(eq(groupEnquiries.status, "NEW_ENQUIRY")),
    getDb().select({ value: count() }).from(payments).where(ne(payments.reconciliationStatus, "RECONCILED")),
    getDb().select({ value: count() }).from(hostOrganizations).where(eq(hostOrganizations.status, "PENDING_VERIFICATION")),
    getDb().select({ value: count() }).from(supportTickets).where(and(inArray(supportTickets.category, ["Safety concern", "Fraud report", "Property damage"]), ne(supportTickets.status, "CLOSED"))),
  ]);
  return [{ label: "New enquiries", value: String(enquiries?.value ?? 0) }, { label: "Payment exceptions", value: String(paymentExceptions?.value ?? 0) }, { label: "Host approvals", value: String(hostApprovals?.value ?? 0) }, { label: "Open incidents", value: String(openIncidents?.value ?? 0) }];
}
