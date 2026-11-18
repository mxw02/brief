import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import {
  deleteBackupById,
  readBackupBuffer,
  restoreBackupById,
} from "@/lib/backups";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  try {
    const buf = await readBackupBuffer(id);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${id}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup nicht gefunden" }, { status: 404 });
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  try {
    const result = await restoreBackupById(id);
    return NextResponse.json({ status: "restored", ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Backup konnte nicht wiederhergestellt werden",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  try {
    await deleteBackupById(id);
    return NextResponse.json({ status: "deleted" });
  } catch {
    return NextResponse.json({ error: "Backup nicht gefunden" }, { status: 404 });
  }
}
