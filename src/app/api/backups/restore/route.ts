import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { restoreBackupFromBuffer } from "@/lib/backups";

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Keine Backup-Datei hochgeladen" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await restoreBackupFromBuffer(buf);
    return NextResponse.json({ status: "restored", ...result });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Hochgeladenes Backup konnte nicht wiederhergestellt werden",
      },
      { status: 400 }
    );
  }
}
