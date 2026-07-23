import { and, eq, inArray } from "drizzle-orm";
import {
  createHostPromotion,
  createHostProperty,
  createHostRatePlan,
  createHostSupportTicket,
  createHostUnit,
  decideHostBooking,
  inviteHostTeamMember,
  proposeHostPayoutAccount,
  recordHostStayEvent,
  sendHostMessage,
  submitHostGuestReview,
  submitHostProperty,
  updateHostInventoryDay,
  uploadHostPropertyImage,
  uploadHostVerificationDocument,
} from "@/app/host/actions";
import { getDb } from "@/db/connection";
import { bookings, conversations, inventoryPools, properties, units } from "@/db/schema";

export async function HostSectionActions({ section, organizationId }: Readonly<{ section: string; organizationId: string }>) {
  const propertyRows = await getDb().select({ id: properties.id, name: properties.name, status: properties.status }).from(properties).where(eq(properties.hostOrganizationId, organizationId)).orderBy(properties.name);

  if (section === "properties") return <div className="workspace-action-grid">
    <form className="workspace-action-card" action={createHostProperty}>
      <h3>Create a property</h3>
      <div className="compact-form-grid">
        <label><span>Name</span><input name="name" required minLength={3} /></label>
        <label><span>Category</span><select name="category"><option>Guest house</option><option>Hotel</option><option>Villa</option><option>Apartment</option><option>Eco lodge</option></select></label>
        <label><span>Destination</span><input name="destination" required /></label><label><span>County</span><input name="county" required /></label>
        <label className="wide"><span>Physical address</span><input name="address" required /></label>
        <label><span>Latitude</span><input name="latitude" type="number" step="any" /></label><label><span>Longitude</span><input name="longitude" type="number" step="any" /></label>
        <label className="wide"><span>Description</span><textarea name="description" required minLength={80} /></label>
      </div><button className="button button-small" type="submit">Save draft property</button>
    </form>
    <form className="workspace-action-card" action={submitHostProperty}>
      <h3>Submit for verification</h3><p>Add at least one active unit before submission.</p>
      <label><span>Draft property</span><select name="propertyId" required><option value="">Select property</option>{propertyRows.filter((property) => ["DRAFT", "CHANGES_REQUESTED"].includes(property.status)).map((property) => <option key={property.id} value={property.id}>{property.name} · {property.status}</option>)}</select></label>
      <button className="button button-small" type="submit">Submit to Coast Bookings</button>
    </form>
    <form className="workspace-action-card" action={uploadHostPropertyImage} encType="multipart/form-data">
      <h3>Add listing photography</h3>
      <label><span>Property</span><select name="propertyId" required>{propertyRows.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
      <label><span>Accessible image description</span><input name="altText" required minLength={5} /></label>
      <label><span>JPG, PNG or WebP (maximum 10 MB)</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
      <button className="button button-small" type="submit">Upload photograph</button>
    </form>
  </div>;

  if (section === "verification") return <form className="workspace-action-card" action={uploadHostVerificationDocument} encType="multipart/form-data">
    <h3>Upload a private verification document</h3><p>Identity, ownership, licence and safety records are stored in private Replit App Storage.</p>
    <div className="compact-form-grid"><label><span>Document type</span><select name="documentType"><option>Identity document</option><option>Business registration</option><option>Property authority</option><option>Tourism licence</option><option>Fire and safety document</option><option>Payout evidence</option></select></label><label><span>Expiry date, if applicable</span><input name="expiresOn" type="date" /></label><label className="wide"><span>PDF, JPG or PNG (maximum 15 MB)</span><input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required /></label></div>
    <button className="button button-small" type="submit">Submit document for review</button>
  </form>;

  if (section === "units") return <form className="workspace-action-card" action={createHostUnit}>
    <h3>Add a room or unit</h3><div className="compact-form-grid">
      <label><span>Property</span><select name="propertyId" required>{propertyRows.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
      <label><span>Unit name</span><input name="name" required /></label><label><span>Unit type</span><input name="unitType" defaultValue="Private room" required /></label>
      <label><span>Booking mode</span><select name="bookingMode"><option value="REQUEST_TO_BOOK">Request to book</option><option value="INSTANT">Instant book</option></select></label>
      <label><span>Adults</span><input name="maxAdults" type="number" min="1" defaultValue="2" required /></label><label><span>Children</span><input name="maxChildren" type="number" min="0" defaultValue="0" required /></label>
      <label><span>Total capacity</span><input name="capacity" type="number" min="1" defaultValue="2" required /></label><label><span>Quantity</span><input name="quantity" type="number" min="1" defaultValue="1" required /></label>
      <label><span>Bedrooms</span><input name="bedrooms" type="number" min="0" defaultValue="1" required /></label><label><span>Bathrooms</span><input name="bathrooms" type="number" min="1" defaultValue="1" required /></label>
      <label><span>Nightly rate (minor units)</span><input name="baseNightlyRateMinor" type="number" min="10000" defaultValue="500000" required /></label><label><span>Cleaning fee (minor units)</span><input name="cleaningFeeMinor" type="number" min="0" defaultValue="0" required /></label>
      <label><span>Minimum stay</span><input name="minimumStay" type="number" min="1" defaultValue="1" required /></label><label><span>Maximum stay</span><input name="maximumStay" type="number" min="1" defaultValue="30" required /></label>
      <label><span>Bed type</span><input name="bedType" defaultValue="Queen bed" required /></label><label><span>Bed quantity</span><input name="bedQuantity" type="number" min="1" defaultValue="1" required /></label>
      <label className="wide"><span>Description</span><textarea name="description" required minLength={20} /></label>
    </div><button className="button button-small" type="submit">Add unit and 12-month calendar</button>
  </form>;

  if (section === "calendar" || section === "availability") {
    const pools = await getDb().select({ id: inventoryPools.id, name: inventoryPools.name, propertyName: properties.name }).from(inventoryPools).innerJoin(properties, eq(properties.id, inventoryPools.propertyId)).where(eq(properties.hostOrganizationId, organizationId));
    return <form className="workspace-action-card" action={updateHostInventoryDay}><h3>Update a calendar date</h3><div className="compact-form-grid"><label><span>Inventory pool</span><select name="poolId" required>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.propertyName} · {pool.name}</option>)}</select></label><label><span>Date</span><input name="inventoryDate" type="date" required /></label><label><span>Available capacity</span><input name="capacity" type="number" min="0" required /></label><label><span>Price override (minor units)</span><input name="priceOverrideMinor" type="number" min="0" /></label><label className="filter-check"><input name="closed" type="checkbox" /><span>Close this date</span></label></div><button className="button button-small" type="submit">Update availability</button></form>;
  }

  const unitRows = await getDb().select({ id: units.id, name: units.name, propertyName: properties.name }).from(units).innerJoin(properties, eq(properties.id, units.propertyId)).where(eq(properties.hostOrganizationId, organizationId)).orderBy(properties.name, units.name);
  if (section === "rates") return <form className="workspace-action-card" action={createHostRatePlan}><h3>Create a date-aware rate plan</h3><div className="compact-form-grid"><label><span>Unit</span><select name="unitId" required>{unitRows.map((unit) => <option key={unit.id} value={unit.id}>{unit.propertyName} · {unit.name}</option>)}</select></label><label><span>Name</span><input name="name" required /></label><label><span>Rate type</span><select name="rateType"><option>SEASONAL</option><option>WEEKEND</option><option>HOLIDAY</option></select></label><label><span>Priority</span><input name="priority" type="number" min="0" defaultValue="0" /></label><label><span>Starts</span><input name="startsOn" type="date" /></label><label><span>Ends</span><input name="endsOn" type="date" /></label><label><span>Days of week (0–6)</span><input name="daysOfWeek" placeholder="5,6" /></label><label><span>Fixed nightly rate (minor units)</span><input name="amountMinor" type="number" min="10000" /></label><label><span>Or adjustment (basis points)</span><input name="adjustmentBasisPoints" type="number" /></label></div><button className="button button-small" type="submit">Create rate plan</button></form>;

  if (section === "promotions") return <form className="workspace-action-card" action={createHostPromotion}><h3>Create a promotion code</h3><div className="compact-form-grid"><label><span>Property</span><select name="propertyId" required>{propertyRows.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label><span>Name</span><input name="name" required /></label><label><span>Code</span><input name="code" required /></label><label><span>Discount percent</span><input name="discountPercent" type="number" min="1" max="80" step="0.01" required /></label><label><span>Starts</span><input name="startsAt" type="datetime-local" required /></label><label><span>Ends</span><input name="endsAt" type="datetime-local" required /></label><label><span>Usage limit</span><input name="usageLimit" type="number" min="1" /></label></div><button className="button button-small" type="submit">Create promotion</button></form>;

  if (section === "reservations") {
    const reservationRows = await getDb().select({ id: bookings.id, reference: bookings.reference, status: bookings.status }).from(bookings).where(and(eq(bookings.hostOrganizationId, organizationId), inArray(bookings.status, ["PENDING_HOST_APPROVAL", "CONFIRMED", "CHECKED_IN"]))).orderBy(bookings.checkIn);
    return <div className="workspace-action-grid"><form className="workspace-action-card" action={decideHostBooking}><h3>Respond to a booking request</h3><div className="compact-form-grid"><label><span>Request</span><select name="bookingId" required>{reservationRows.filter((booking) => booking.status === "PENDING_HOST_APPROVAL").map((booking) => <option key={booking.id} value={booking.id}>{booking.reference}</option>)}</select></label><label><span>Decision</span><select name="decision"><option value="ACCEPT">Accept</option><option value="DECLINE">Decline</option></select></label><label className="wide"><span>Reason or message</span><textarea name="reason" maxLength={500} /></label></div><button className="button button-small" type="submit">Record decision</button></form><form className="workspace-action-card" action={recordHostStayEvent}><h3>Record stay operations</h3><label><span>Reservation</span><select name="bookingId" required>{reservationRows.filter((booking) => booking.status !== "PENDING_HOST_APPROVAL").map((booking) => <option key={booking.id} value={booking.id}>{booking.reference} · {booking.status}</option>)}</select></label><label><span>Event</span><select name="event"><option value="CHECK_IN">Check in</option><option value="CHECK_OUT">Check out</option><option value="NO_SHOW">No show</option></select></label><label><span>Operational note</span><textarea name="reason" /></label><button className="button button-small" type="submit">Record event</button></form></div>;
  }

  if (section === "messages") {
    const conversationRows = await getDb().select({ id: conversations.id, subject: conversations.subject }).from(conversations).innerJoin(bookings, eq(bookings.id, conversations.bookingId)).where(eq(bookings.hostOrganizationId, organizationId));
    return <form className="workspace-action-card" action={sendHostMessage}><h3>Reply to a guest</h3><label><span>Conversation</span><select name="conversationId" required>{conversationRows.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.subject}</option>)}</select></label><label><span>Message</span><textarea name="body" required maxLength={4000} /></label><button className="button button-small" type="submit">Send message</button></form>;
  }

  if (section === "reviews") {
    const completed = await getDb().select({ id: bookings.id, reference: bookings.reference }).from(bookings).where(and(eq(bookings.hostOrganizationId, organizationId), inArray(bookings.status, ["CHECKED_OUT", "COMPLETED"])));
    return <form className="workspace-action-card" action={submitHostGuestReview}><h3>Review a completed guest stay</h3><div className="compact-form-grid"><label><span>Booking</span><select name="bookingId" required>{completed.map((booking) => <option key={booking.id} value={booking.id}>{booking.reference}</option>)}</select></label><label><span>Communication (1–5)</span><input name="communication" type="number" min="1" max="5" required /></label><label><span>House rules (1–5)</span><input name="houseRules" type="number" min="1" max="5" required /></label><label className="wide"><span>Private-to-public review text</span><textarea name="body" required minLength={20} /></label></div><button className="button button-small" type="submit">Submit double-blind review</button></form>;
  }

  if (section === "team") return <form className="workspace-action-card" action={inviteHostTeamMember}><h3>Invite a co-host or employee</h3><p>Roles do not grant payout-account access unless explicitly designed to do so.</p><div className="compact-form-grid"><label><span>Email</span><input name="email" type="email" required /></label><label><span>Role</span><select name="role"><option value="org:property_manager">Property manager</option><option value="org:reservations">Reservations</option><option value="org:front_desk">Front desk</option><option value="org:accountant">Accountant</option><option value="org:viewer">Read-only viewer</option></select></label></div><button className="button button-small" type="submit">Send 14-day invitation</button></form>;

  if (section === "payouts") return <form className="workspace-action-card" action={proposeHostPayoutAccount}><h3>Propose new payout details</h3><p>Details are encrypted and remain inactive until a finance officer approves the change. Recent MFA verification is required.</p><div className="compact-form-grid"><label><span>Account type</span><select name="accountType"><option>MPESA</option><option>BANK</option></select></label><label><span>Account holder</span><input name="accountName" required /></label><label><span>M-Pesa number or bank account</span><input name="accountReference" required autoComplete="off" /></label><label><span>Bank name, if applicable</span><input name="bankName" /></label><label className="wide"><span>Reason for change</span><textarea name="reason" required minLength={10} /></label></div><button className="button button-small" type="submit">Submit for finance approval</button></form>;

  if (section === "support") return <form className="workspace-action-card" action={createHostSupportTicket}><h3>Open a host support ticket</h3><div className="compact-form-grid"><label><span>Category</span><select name="category"><option>Booking issue</option><option>Payment issue</option><option>Property issue</option><option>Account problem</option><option>Safety concern</option><option>Technical issue</option></select></label><label><span>Priority</span><select name="priority"><option>NORMAL</option><option>LOW</option><option>HIGH</option><option>URGENT</option></select></label><label className="wide"><span>Subject</span><input name="subject" required /></label><label className="wide"><span>Details</span><textarea name="body" required minLength={10} /></label></div><button className="button button-small" type="submit">Create ticket</button></form>;
  return null;
}
