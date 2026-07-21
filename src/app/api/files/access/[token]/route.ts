import { NextResponse } from "next/server";
import { requireActiveUser } from "@/modules/authorization/service";
import { consumeFileAccessToken, downloadStoredFile } from "@/modules/storage/service";

export async function GET(_: Request, { params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const context = await requireActiveUser();
  const { token } = await params;
  const file = await consumeFileAccessToken(token, context.user.id);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const bytes = await downloadStoredFile(file);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${file.originalName.replaceAll('"', '')}"`, "Cache-Control": "private, no-store" } });
}
