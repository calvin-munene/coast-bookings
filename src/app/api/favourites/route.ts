import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { favourites, properties } from "@/db/schema";
import { fail } from "@/lib/api";
import { requireGuest } from "@/modules/authorization/service";

const schema = z.object({ propertyId: z.string().uuid() });

async function input(request: Request) { return schema.safeParse(await request.json().catch(() => null)); }

export async function POST(request: Request) {
  const parsed = await input(request); if (!parsed.success) return fail("INVALID_FAVOURITE", "Property is invalid", 400);
  try {
    const context = await requireGuest();
    const [property] = await getDb().select({ id: properties.id }).from(properties).where(and(eq(properties.id, parsed.data.propertyId), eq(properties.status, "PUBLISHED"))).limit(1);
    if (!property) return fail("PROPERTY_NOT_FOUND", "Property was not found", 404);
    await getDb().insert(favourites).values({ userId: context.user.id, propertyId: property.id }).onConflictDoNothing();
    return NextResponse.json({ data: { saved: true } });
  } catch { return fail("AUTHENTICATION_REQUIRED", "Sign in as a guest to save properties", 401); }
}

export async function DELETE(request: Request) {
  const parsed = await input(request); if (!parsed.success) return fail("INVALID_FAVOURITE", "Property is invalid", 400);
  try { const context = await requireGuest(); await getDb().delete(favourites).where(and(eq(favourites.userId, context.user.id), eq(favourites.propertyId, parsed.data.propertyId))); return NextResponse.json({ data: { saved: false } }); }
  catch { return fail("AUTHENTICATION_REQUIRED", "Sign in as a guest to manage saved properties", 401); }
}
