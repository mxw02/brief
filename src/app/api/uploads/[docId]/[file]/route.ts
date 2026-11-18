import { NextResponse, type NextRequest } from "next/server";
import { canAccessSpace, canEditDocuments, getSessionUser } from "@/lib/auth";
import { dbReadWorkspace } from "@/lib/db";
import { deletePdfAttachment, readPdfAttachment } from "@/lib/uploads";

async function authorizeFileAccess(docId: string, requireWrite: boolean) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (requireWrite && !canEditDocuments(user)) {
    return NextResponse.json(
      { error: "Viewer haben nur Lesezugriff" },
      { status: 403 }
    );
  }
  const { documents } = await dbReadWorkspace();
  const doc = documents.find((d) => d.id === docId);
  if (doc && !canAccessSpace(user, doc.spaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ docId: string; file: string }> }
) {
  const { docId, file } = await context.params;
  const denied = await authorizeFileAccess(docId, false);
  if (denied) return denied;

  try {
    const { buffer, originalName } = await readPdfAttachment(docId, file);
    const safeDownloadName = originalName.replace(/["\r\n]/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeDownloadName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF nicht gefunden" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ docId: string; file: string }> }
) {
  const { docId, file } = await context.params;
  const denied = await authorizeFileAccess(docId, true);
  if (denied) return denied;

  try {
    await deletePdfAttachment(docId, file);
    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "PDF konnte nicht gelöscht werden",
      },
      { status: 400 }
    );
  }
}
