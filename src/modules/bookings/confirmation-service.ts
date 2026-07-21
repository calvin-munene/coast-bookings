import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

export type ConfirmationInput = Readonly<{
  bookingId: string;
  paymentId: string;
  providerEventId: string;
}>;

/**
 * Confirms a paid booking atomically. The database function locks every inventory
 * day, rechecks capacity, converts held stock to sold stock, and records the
 * webhook event exactly once. See the generated SQL migration for the invariant.
 */
export async function confirmPaidBooking(input: ConfirmationInput): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select confirm_paid_booking(${input.bookingId}::uuid, ${input.paymentId}::uuid, ${input.providerEventId}::text)`);
  });
}
