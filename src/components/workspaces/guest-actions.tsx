import { and, eq, inArray } from "drizzle-orm";
import {
  addPropertyToGuestWishlist,
  createGuestSavedSearch,
  createGuestSupportTicket,
  createGuestWishlist,
  requestGuestCancellation,
  requestGuestDateChange,
  sendGuestMessage,
  submitGuestReview,
  updateGuestNotificationPreferences,
} from "@/app/guest/actions";
import { ExistingBookingCheckout } from "@/components/existing-booking-checkout";
import { getDb } from "@/db/connection";
import { bookings, conversationMembers, conversations, favourites, properties, wishlists } from "@/db/schema";

export async function GuestSectionActions({ section, userId }: Readonly<{ section: string; userId: string }>) {
  const bookingRows = await getDb().select({ id: bookings.id, reference: bookings.reference, status: bookings.status, paymentStatus: bookings.paymentStatus }).from(bookings).where(eq(bookings.guestUserId, userId)).orderBy(bookings.createdAt);

  if (["upcoming-stays", "pending-requests"].includes(section)) return <div className="workspace-action-grid">
    <form className="workspace-action-card" action={requestGuestCancellation}><h3>Cancel or request cancellation</h3><div className="compact-form-grid"><label><span>Booking</span><select name="bookingId" required>{bookingRows.filter((booking) => !["COMPLETED", "REFUNDED", "CANCELLED_BY_GUEST", "CANCELLED_BY_HOST", "CANCELLED_BY_ADMIN"].includes(booking.status)).map((booking) => <option key={booking.id} value={booking.id}>{booking.reference} · {booking.status}</option>)}</select></label><label className="wide"><span>Reason</span><textarea name="reason" required minLength={10} /></label></div><button className="button button-small" type="submit">Submit cancellation</button></form>
    <form className="workspace-action-card" action={requestGuestDateChange}><h3>Request new dates</h3><div className="compact-form-grid"><label><span>Booking</span><select name="bookingId" required>{bookingRows.filter((booking) => ["PENDING_HOST_APPROVAL", "AWAITING_PAYMENT", "CONFIRMED"].includes(booking.status)).map((booking) => <option key={booking.id} value={booking.id}>{booking.reference}</option>)}</select></label><label><span>New check-in</span><input name="checkIn" type="date" required /></label><label><span>New check-out</span><input name="checkOut" type="date" required /></label><label className="wide"><span>Reason</span><textarea name="reason" required minLength={10} /></label></div><button className="button button-small" type="submit">Request date change</button></form>
  </div>;

  if (section === "payments") {
    const payable = bookingRows.filter((booking) => ["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(booking.status) || (booking.status === "CONFIRMED" && booking.paymentStatus === "PARTIALLY_PAID"));
    return <div className="workspace-action-grid">{payable.map((booking) => <article className="workspace-action-card" key={booking.id}><h3>{booking.reference}</h3><p>{booking.status === "CONFIRMED" ? "A later instalment or balance is due." : "This booking is ready for secure payment."}</p><ExistingBookingCheckout bookingId={booking.id} /></article>)}</div>;
  }

  if (section === "messages") {
    const rows = await getDb().select({ id: conversations.id, subject: conversations.subject }).from(conversationMembers).innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId)).where(eq(conversationMembers.userId, userId));
    return <form className="workspace-action-card" action={sendGuestMessage}><h3>Send a booking message</h3><label><span>Conversation</span><select name="conversationId" required>{rows.map((row) => <option key={row.id} value={row.id}>{row.subject}</option>)}</select></label><label><span>Message</span><textarea name="body" required maxLength={4000} /></label><button className="button button-small" type="submit">Send securely</button></form>;
  }

  if (section === "reviews") {
    const rows = await getDb().select({ id: bookings.id, reference: bookings.reference }).from(bookings).where(and(eq(bookings.guestUserId, userId), inArray(bookings.status, ["CHECKED_OUT", "COMPLETED"])));
    return <form className="workspace-action-card" action={submitGuestReview}><h3>Review a completed stay</h3><div className="compact-form-grid"><label><span>Booking</span><select name="bookingId" required>{rows.map((row) => <option key={row.id} value={row.id}>{row.reference}</option>)}</select></label>{["overall", "accuracy", "cleanliness", "communication", "location", "checkIn", "amenities", "value"].map((rating) => <label key={rating}><span>{rating === "checkIn" ? "Check-in" : rating.charAt(0).toUpperCase() + rating.slice(1)}</span><input name={rating} type="number" min="1" max="5" required /></label>)}<label className="wide"><span>Review</span><textarea name="body" required minLength={20} /></label></div><button className="button button-small" type="submit">Submit double-blind review</button></form>;
  }

  if (section === "favourites" || section === "wishlists") {
    const [savedProperties, lists] = await Promise.all([
      getDb().select({ id: properties.id, name: properties.name }).from(favourites).innerJoin(properties, eq(properties.id, favourites.propertyId)).where(eq(favourites.userId, userId)),
      getDb().select({ id: wishlists.id, name: wishlists.name }).from(wishlists).where(eq(wishlists.ownerUserId, userId)),
    ]);
    return <div className="workspace-action-grid"><form className="workspace-action-card" action={createGuestWishlist}><h3>Create a named wishlist</h3><label><span>Name</span><input name="name" required /></label><label><span>Visibility</span><select name="visibility"><option>PRIVATE</option><option>SHARED</option></select></label><button className="button button-small" type="submit">Create wishlist</button></form><form className="workspace-action-card" action={addPropertyToGuestWishlist}><h3>Add a saved property to a list</h3><label><span>Wishlist</span><select name="wishlistId" required>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label><label><span>Property</span><select name="propertyId" required>{savedProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label><span>Note</span><textarea name="note" maxLength={500} /></label><button className="button button-small" type="submit">Add to wishlist</button></form></div>;
  }

  if (section === "saved-searches") return <form className="workspace-action-card" action={createGuestSavedSearch}><h3>Save a marketplace search</h3><div className="compact-form-grid"><label><span>Name</span><input name="name" required /></label><label><span>Destination</span><input name="destination" /></label><label><span>Adults</span><input name="adults" type="number" min="1" defaultValue="2" required /></label><label><span>Rooms</span><input name="rooms" type="number" min="1" defaultValue="1" required /></label><label><span>Property type</span><select name="propertyType"><option value="">Any</option><option>Guest house</option><option>Hotel</option><option>Villa</option><option>Apartment</option></select></label><label><span>Maximum nightly rate (minor units)</span><input name="maxPriceMinor" type="number" min="0" /></label><label className="filter-check"><input name="alertsEnabled" type="checkbox" /><span>Email me when new matches appear</span></label></div><button className="button button-small" type="submit">Save search</button></form>;

  if (section === "profile") return <form className="workspace-action-card" action={updateGuestNotificationPreferences}><h3>Notification and marketing choices</h3><p>Email remains the default transactional channel. SMS and WhatsApp require explicit opt-in.</p><label className="consent-row"><input name="smsTransactional" type="checkbox" /><span>Transactional SMS</span></label><label className="consent-row"><input name="whatsappTransactional" type="checkbox" /><span>Transactional WhatsApp templates</span></label><label className="consent-row"><input name="marketing" type="checkbox" /><span>Coast Bookings offers and destination inspiration</span></label><button className="button button-small" type="submit">Save choices</button></form>;

  if (section === "dashboard") return <form className="workspace-action-card" action={createGuestSupportTicket}><h3>Request Coast Bookings support</h3><div className="compact-form-grid"><label><span>Related booking</span><select name="bookingId"><option value="">Account-level request</option>{bookingRows.map((row) => <option key={row.id} value={row.id}>{row.reference}</option>)}</select></label><label><span>Category</span><select name="category"><option>Booking change</option><option>Payment issue</option><option>Cancellation</option><option>Refund</option><option>Property complaint</option><option>Safety concern</option><option>Technical issue</option></select></label><label><span>Priority</span><select name="priority" defaultValue="NORMAL"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label><label><span>Subject</span><input name="subject" required /></label><label className="wide"><span>How can we help?</span><textarea name="body" required minLength={10} /></label></div><button className="button button-small" type="submit">Create support ticket</button></form>;
  return null;
}
