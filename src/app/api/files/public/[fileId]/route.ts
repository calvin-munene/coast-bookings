import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { storedFiles } from "@/db/schema";
import { downloadStoredFile } from "@/modules/storage/service";

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ fileId: string }> }>) {
  const { fileId } = await params;
  const [file] = await getDb().select().from(storedFiles).where(and(eq(storedFiles.id, fileId), eq(storedFiles.classification, "PUBLIC"), isNull(storedFiles.deletedAt))).limit(1);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const bytes = await downloadStoredFile(file);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
}
