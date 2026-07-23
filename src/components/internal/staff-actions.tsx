import { eq, inArray, ne } from "drizzle-orm";
import {
  addGroupQuoteOption,
  approvePayout,
  createRefundRequest,
  createStaffManualBooking,
  decideHostOrganization,
  decidePayoutAccount,
  decideRefund,
  progressGroupEnquiry,
  reconcilePayment,
  recordOfflinePayment,
  resolveDispute,
  reviewHostDocument,
  reviewProperty,
  sendGroupQuote,
  updateSupportTicket,
} from "@/app/staff/actions";
import { getDb } from "@/db/connection";
import { bookings, disputes, groupEnquiries, groupQuoteOptions, groupQuotes, hostDocuments, hostOrganizations, hostProfiles, payments, payoutAccounts, payouts, properties, refunds, supportTickets, units, users } from "@/db/schema";
import { formatKes } from "@/lib/format";

export async function StaffSectionActions({ section }: Readonly<{ section: string }>) {
  if (section === "property-verification") {
    const rows = await getDb().select({ id: properties.id, name: properties.name, status: properties.status }).from(properties).where(inArray(properties.status, ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "PUBLISHED"]));
    return <form className="workspace-action-card" action={reviewProperty}><h3>Review a property</h3><div className="compact-form-grid"><label><span>Property</span><select name="propertyId" required>{rows.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.status}</option>)}</select></label><label><span>Decision</span><select name="decision"><option value="PUBLISH">Verify and publish</option><option value="REQUEST_CHANGES">Request changes</option><option value="SUSPEND">Suspend</option><option value="REJECT">Reject</option></select></label><label className="wide"><span>Recorded reason</span><textarea name="reason" required minLength={5} /></label></div><button className="button button-small" type="submit">Record listing decision</button></form>;
  }

  if (section === "host-onboarding") {
    const [organizations, documents] = await Promise.all([
      getDb().select({ id: hostOrganizations.id, name: hostOrganizations.name, status: hostOrganizations.status }).from(hostOrganizations).where(ne(hostOrganizations.type, "INTERNAL")),
      getDb().select({ id: hostDocuments.id, type: hostDocuments.documentType, status: hostDocuments.status, organisation: hostOrganizations.name }).from(hostDocuments).innerJoin(hostProfiles, eq(hostProfiles.id, hostDocuments.hostId)).innerJoin(hostOrganizations, eq(hostOrganizations.id, hostProfiles.hostOrganizationId)).where(inArray(hostDocuments.status, ["PENDING", "REUPLOAD_REQUESTED"])),
    ]);
    return <div className="workspace-action-grid"><form className="workspace-action-card" action={reviewHostDocument}><h3>Review private host document</h3><label><span>Document</span><select name="documentId" required>{documents.map((document) => <option key={document.id} value={document.id}>{document.organisation} · {document.type} · {document.status}</option>)}</select></label><label><span>Decision</span><select name="decision"><option value="APPROVE">Approve</option><option value="REJECT">Reject</option><option value="REQUEST_REUPLOAD">Request re-upload</option></select></label><label><span>Reason or verification note</span><textarea name="reason" required minLength={5} /></label><button className="button button-small" type="submit">Record document review</button></form><form className="workspace-action-card" action={decideHostOrganization}><h3>Decide host organisation</h3><label><span>Organisation</span><select name="organizationId" required>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.status}</option>)}</select></label><label><span>Decision</span><select name="decision"><option>VERIFY</option><option>SUSPEND</option><option>REJECT</option></select></label><label><span>Mandatory reason</span><textarea name="reason" required minLength={5} /></label><button className="button button-small" type="submit">Record host decision</button></form></div>;
  }

  if (["group-enquiries", "crm", "property-sourcing", "quotations"].includes(section)) {
    const rows = await getDb().select({ id: groupEnquiries.id, reference: groupEnquiries.reference, name: groupEnquiries.organisationName, status: groupEnquiries.status }).from(groupEnquiries).where(ne(groupEnquiries.status, "CONVERTED_TO_BOOKING"));
    if (section === "quotations") {
      const [unitRows, quoteRows] = await Promise.all([
        getDb().select({ id: units.id, name: units.name, propertyName: properties.name }).from(units).innerJoin(properties, eq(properties.id, units.propertyId)).where(eq(properties.status, "PUBLISHED")),
        getDb().select({ id: groupQuotes.id, reference: groupQuotes.reference, optionId: groupQuoteOptions.id }).from(groupQuotes).leftJoin(groupQuoteOptions, eq(groupQuoteOptions.quoteId, groupQuotes.id)).where(eq(groupQuotes.status, "DRAFT")),
      ]);
      const sendableQuotes = [...new Map(quoteRows.filter((row) => row.optionId).map((row) => [row.id, row])).values()];
      return <div className="workspace-action-grid"><form className="workspace-action-card" action={addGroupQuoteOption}><h3>Add comparison option</h3><div className="compact-form-grid"><label><span>Enquiry</span><select name="enquiryId" required>{rows.map((row) => <option key={row.id} value={row.id}>{row.reference} · {row.name}</option>)}</select></label><label><span>Property unit</span><select name="unitId" required>{unitRows.map((row) => <option key={row.id} value={row.id}>{row.propertyName} · {row.name}</option>)}</select></label><label><span>Option title</span><input name="title" required /></label><label><span>Rooms</span><input name="quantity" type="number" min="1" required /></label><label><span>Total (minor units)</span><input name="totalMinor" type="number" min="1" required /></label><label><span>Deposit (minor units)</span><input name="depositMinor" type="number" min="0" required /></label><label className="wide"><span>Rooming arrangement</span><textarea name="roomingArrangement" required minLength={10} /></label><label><span>Inclusions, one per line</span><textarea name="inclusions" /></label><label><span>Exclusions, one per line</span><textarea name="exclusions" /></label><label className="wide"><span>Cancellation policy</span><textarea name="cancellationPolicy" required minLength={10} /></label></div><button className="button button-small" type="submit">Reserve inventory and add option</button></form><form className="workspace-action-card" action={sendGroupQuote}><h3>Approve and send quotation</h3><label><span>Draft quote</span><select name="quoteId" required>{sendableQuotes.map((row) => <option key={row.id} value={row.id}>{row.reference}</option>)}</select></label><label><span>Approval reason</span><textarea name="reason" required minLength={5} /></label><button className="button button-small" type="submit">Send secure acceptance link</button></form></div>;
    }
    return <form className="workspace-action-card" action={progressGroupEnquiry}><h3>Progress a group enquiry</h3><div className="compact-form-grid"><label><span>Enquiry</span><select name="enquiryId" required>{rows.map((row) => <option key={row.id} value={row.id}>{row.reference} · {row.name} · {row.status}</option>)}</select></label><label><span>Next stage</span><select name="status"><option>REQUIREMENTS_CONFIRMED</option><option>SOURCING_PROPERTIES</option><option>AWAITING_HOST_RESPONSES</option><option>PREPARING_QUOTE</option><option>QUOTE_SENT</option><option>NEGOTIATING</option><option>ACCEPTED</option><option>DECLINED</option><option>EXPIRED</option></select></label><label className="wide"><span>Internal note</span><textarea name="note" /></label></div><button className="button button-small" type="submit">Update group workflow</button></form>;
  }

  if (section === "manual-bookings") {
    const [guestRows, unitRows] = await Promise.all([
      getDb().select({ id: users.id, name: users.fullName, email: users.primaryEmail }).from(users).where(eq(users.status, "ACTIVE")),
      getDb().select({ id: units.id, name: units.name, propertyName: properties.name }).from(units).innerJoin(properties, eq(properties.id, units.propertyId)).where(eq(properties.status, "PUBLISHED")),
    ]);
    return <form className="workspace-action-card" action={createStaffManualBooking}><h3>Create an assisted booking</h3><div className="compact-form-grid"><label><span>Guest account</span><select name="guestUserId" required>{guestRows.map((guest) => <option key={guest.id} value={guest.id}>{guest.name} · {guest.email}</option>)}</select></label><label><span>Unit</span><select name="unitId" required>{unitRows.map((unit) => <option key={unit.id} value={unit.id}>{unit.propertyName} · {unit.name}</option>)}</select></label><label><span>Check-in</span><input name="checkIn" type="date" required /></label><label><span>Check-out</span><input name="checkOut" type="date" required /></label><label><span>Adults</span><input name="adults" type="number" min="1" defaultValue="2" required /></label><label><span>Children</span><input name="children" type="number" min="0" defaultValue="0" required /></label><label><span>Rooms</span><input name="rooms" type="number" min="1" defaultValue="1" required /></label><label className="wide"><span>Guest requirements</span><textarea name="guestRequirements" /></label></div><button className="button button-small" type="submit">Create inventory-backed booking</button></form>;
  }

  if (section === "payments") {
    const [bookingRows, paymentRows] = await Promise.all([
      getDb().select({ id: bookings.id, reference: bookings.reference, status: bookings.status }).from(bookings).where(inArray(bookings.status, ["AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_FAILED", "CONFIRMED"])),
      getDb().select({ id: payments.id, reference: payments.reference, status: payments.status, reconciliation: payments.reconciliationStatus }).from(payments).where(ne(payments.reconciliationStatus, "RECONCILED")),
    ]);
    return <div className="workspace-action-grid"><form className="workspace-action-card" action={recordOfflinePayment}><h3>Record verified offline payment</h3><div className="compact-form-grid"><label><span>Booking</span><select name="bookingId" required>{bookingRows.map((row) => <option key={row.id} value={row.id}>{row.reference} · {row.status}</option>)}</select></label><label><span>Method</span><select name="method"><option>BANK_TRANSFER</option><option>MANUAL_MPESA</option><option>OFFLINE</option></select></label><label><span>Amount (minor units)</span><input name="amountMinor" type="number" min="1" required /></label><label><span>External reference</span><input name="externalReference" required /></label></div><button className="button button-small" type="submit">Record reconciled payment</button></form><form className="workspace-action-card" action={reconcilePayment}><h3>Reconcile provider payment</h3><label><span>Payment</span><select name="paymentId" required>{paymentRows.map((row) => <option key={row.id} value={row.id}>{row.reference} · {row.status} · {row.reconciliation}</option>)}</select></label><label><span>Outcome</span><select name="status"><option>RECONCILED</option><option>EXCEPTION</option></select></label><label><span>Reason</span><textarea name="reason" required minLength={5} /></label><button className="button button-small" type="submit">Save reconciliation</button></form></div>;
  }

  if (section === "refunds") {
    const [refundRows, refundablePayments] = await Promise.all([
      getDb().select({ id: refunds.id, amount: refunds.amountMinor }).from(refunds).where(eq(refunds.status, "PENDING")),
      getDb().select({ id: payments.id, reference: payments.reference, amount: payments.amountMinor }).from(payments).where(inArray(payments.status, ["SUCCEEDED", "PARTIALLY_REFUNDED"])),
    ]);
    return <div className="workspace-action-grid"><form className="workspace-action-card" action={createRefundRequest}><h3>Calculate refund request</h3><div className="compact-form-grid"><label><span>Verified payment</span><select name="paymentId" required>{refundablePayments.map((payment) => <option key={payment.id} value={payment.id}>{payment.reference} · {formatKes(payment.amount)}</option>)}</select></label><label><span>Accommodation refundable %</span><input name="refundableAccommodationPercent" type="number" min="0" max="100" step="0.01" required /></label><label><span>Provider charges retained</span><input name="providerChargesMinor" type="number" min="0" defaultValue="0" required /></label><label><span>Guest penalty</span><input name="guestPenaltyMinor" type="number" min="0" defaultValue="0" required /></label><label><span>Manual adjustment (+/−)</span><input name="manualAdjustmentMinor" type="number" defaultValue="0" required /></label><label className="filter-check"><input name="serviceFeeRefundable" type="checkbox" /><span>Refund service fee</span></label><label className="wide"><span>Policy basis and reason</span><textarea name="reason" required minLength={10} /></label></div><button className="button button-small" type="submit">Create approval request</button></form><form className="workspace-action-card" action={decideRefund}><h3>Approve or reject refund</h3><label><span>Refund</span><select name="refundId" required>{refundRows.map((refund) => <option key={refund.id} value={refund.id}>{refund.id} · {formatKes(refund.amount)}</option>)}</select></label><label><span>Decision</span><select name="decision"><option value="APPROVE">Approve</option><option value="REJECT">Reject</option></select></label><label><span>Mandatory reason</span><textarea name="reason" required minLength={5} /></label><button className="button button-small" type="submit">Record refund decision</button></form></div>;
  }

  if (section === "payouts") {
    const [payoutRows, accountRows] = await Promise.all([
      getDb().select({ id: payouts.id, reference: payouts.reference, status: payouts.status }).from(payouts).where(ne(payouts.status, "REVERSED")),
      getDb().select({ id: payoutAccounts.id, type: payoutAccounts.accountType, organisation: hostOrganizations.name }).from(payoutAccounts).innerJoin(hostOrganizations, eq(hostOrganizations.id, payoutAccounts.hostOrganizationId)).where(eq(payoutAccounts.status, "PENDING_APPROVAL")),
    ]);
    return <div className="workspace-action-grid"><form className="workspace-action-card" action={decidePayoutAccount}><h3>Approve changed payout details</h3><p>Account values stay encrypted; finance validates the supplied evidence through the controlled document viewer.</p><label><span>Pending account</span><select name="accountId" required>{accountRows.map((account) => <option key={account.id} value={account.id}>{account.organisation} · {account.type}</option>)}</select></label><label><span>Decision</span><select name="decision"><option>APPROVE</option><option>REJECT</option></select></label><label><span>Mandatory reason</span><textarea name="reason" required minLength={10} /></label><button className="button button-small" type="submit">Record account decision</button></form><form className="workspace-action-card" action={approvePayout}><h3>Control a manual host payout</h3><div className="compact-form-grid"><label><span>Payout</span><select name="payoutId" required>{payoutRows.map((row) => <option key={row.id} value={row.id}>{row.reference} · {row.status}</option>)}</select></label><label><span>Action</span><select name="decision"><option>APPROVE</option><option>HOLD</option><option>MARK_PAID</option></select></label><label><span>External reference</span><input name="externalReference" /></label><label className="wide"><span>Mandatory reason</span><textarea name="reason" required minLength={5} /></label></div><button className="button button-small" type="submit">Update payout</button></form></div>;
  }

  if (section === "support") {
    const tickets = await getDb().select({ id: supportTickets.id, reference: supportTickets.reference, subject: supportTickets.subject, status: supportTickets.status }).from(supportTickets).where(ne(supportTickets.status, "CLOSED"));
    return <form className="workspace-action-card" action={updateSupportTicket}><h3>Respond to support case</h3><label><span>Ticket</span><select name="ticketId" required>{tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.reference} · {ticket.subject} · {ticket.status}</option>)}</select></label><label><span>Next status</span><select name="status"><option>IN_PROGRESS</option><option>WAITING_ON_USER</option><option>RESOLVED</option><option>CLOSED</option></select></label><label><span>Response or internal note</span><textarea name="response" required minLength={5} /></label><label className="filter-check"><input name="internal" type="checkbox" /><span>Internal note only</span></label><button className="button button-small" type="submit">Update support case</button></form>;
  }

  if (section === "disputes") {
    const rows = await getDb().select({ id: disputes.id, reference: disputes.reference, category: disputes.category }).from(disputes).where(ne(disputes.status, "CLOSED"));
    return <form className="workspace-action-card" action={resolveDispute}><h3>Resolve a dispute</h3><div className="compact-form-grid"><label><span>Dispute</span><select name="disputeId" required>{rows.map((row) => <option key={row.id} value={row.id}>{row.reference} · {row.category}</option>)}</select></label><label><span>Outcome</span><select name="outcome"><option>RESOLVED_GUEST</option><option>RESOLVED_HOST</option><option>CLOSED_NO_ACTION</option></select></label><label className="wide"><span>Decision and evidence summary</span><textarea name="resolution" required minLength={10} /></label></div><button className="button button-small" type="submit">Close dispute with audit log</button></form>;
  }
  return null;
}
