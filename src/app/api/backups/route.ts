import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { createBackupSnapshot, listBackups } from "@/lib/backups";
import {
  dbGetBackupPolicy,
  dbSetBackupPolicy,
  type BackupPolicy,
} from "@/lib/db";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [backups, policy] = await Promise.all([
    listBackups(),
    dbGetBackupPolicy(),
  ]);
  return NextResponse.json({ backups, policy });
}

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const backup = await createBackupSnapshot(auth.user.name);
    return NextResponse.json({ backup }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Backup konnte nicht erstellt werden",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as Partial<BackupPolicy>;
    const policy = await dbSetBackupPolicy(body);
    return NextResponse.json({ policy });
  } catch {
    return NextResponse.json(
      { error: "Backup-Strategie konnte nicht gespeichert werden" },
      { status: 400 }
    );
  }
}
