export type InternalBookingDTO = Readonly<{
  id: string;
  reference: string;
  guestUserId: string;
  hostOrganizationId: string;
  status: string;
  guestTotalMinor: number;
  commissionMinor: number;
  hostNetMinor: number;
  riskFlags: readonly string[];
  internalNotes: string | null;
  currency: string;
}>;

export type InternalHostDTO = Readonly<{
  id: string;
  clerkOrganizationId: string;
  name: string;
  status: string;
  riskRating: string;
  riskFlags: readonly string[];
  internalNotes: string | null;
}>;

export type InternalFinanceDTO = Readonly<{
  bookingId: string;
  grossMinor: number;
  taxMinor: number;
  serviceFeeMinor: number;
  commissionMinor: number;
  hostNetMinor: number;
  currency: string;
}>;
