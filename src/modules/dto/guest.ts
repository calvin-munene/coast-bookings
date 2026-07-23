export type GuestBookingDTO = Readonly<{
  id: string;
  reference: string;
  propertyName: string;
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  guestTotalMinor: number;
  currency: string;
}>;

export type GuestBookingSource = GuestBookingDTO & Readonly<{
  hostOrganizationId?: string;
  commissionMinor?: number;
  hostNetMinor?: number;
  internalNotes?: string | null;
  riskFlags?: readonly string[];
}>;

export function toGuestBookingDTO(source: GuestBookingSource): GuestBookingDTO {
  const { id, reference, propertyName, status, paymentStatus, checkIn, checkOut, guestTotalMinor, currency } = source;
  return { id, reference, propertyName, status, paymentStatus, checkIn, checkOut, guestTotalMinor, currency };
}
