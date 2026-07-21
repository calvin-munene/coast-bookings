export type HostBookingDTO = Readonly<{
  id: string;
  reference: string;
  guestDisplayName: string;
  status: string;
  checkIn: string;
  checkOut: string;
  unitCount: number;
  expectedEarningsMinor: number;
  currency: string;
}>;

export type HostBookingSource = HostBookingDTO & Readonly<{
  guestEmail?: string;
  guestTelephone?: string;
  serviceFeeMinor?: number;
  internalMarginMinor?: number;
  internalNotes?: string | null;
  riskFlags?: readonly string[];
}>;

export function toHostBookingDTO(source: HostBookingSource): HostBookingDTO {
  const { id, reference, guestDisplayName, status, checkIn, checkOut, unitCount, expectedEarningsMinor, currency } = source;
  return { id, reference, guestDisplayName, status, checkIn, checkOut, unitCount, expectedEarningsMinor, currency };
}
