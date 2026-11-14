import { NextResponse, type NextRequest } from "next/server";
import { revokeApiToken } from "@/lib/server-store";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const removed = await revokeApiToken(id);
  if (!removed) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
