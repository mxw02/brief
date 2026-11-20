import { NextResponse, type NextRequest } from "next/server";
import { canAccessSpace, canEditDocuments, getSessionUser } from "@/lib/auth";
import { dbReadWorkspace } from "@/lib/db";
import { listPageAttachments, savePdfAttachment } from "@/lib/uploads";

async function authorizePage(docId: string, requireWrite: boolean) {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (requireWrite && !canEditDocuments(user)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Viewer haben nur Lesezugriff" },
        { status: 403 }
      ),
    };
  }
  const { documents } = await dbReadWorkspace();
  const doc = documents.find((d) => d.id === docId);
  if (doc && !canAccessSpace(user, doc.spaceId)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, user };
}

export async function GET(request: NextRequest) {
  const docId = new URL(request.url).searchParams.get("docId")?.trim() || "";
  if (!docId) {
    return NextResponse.json(
      { error: "docId ist erforderlich" },
      { status: 400 }
    );
  }

  const auth = await authorizePage(docId, false);
  if (!auth.ok) return auth.response;

  try {
    const attachments = await listPageAttachments(docId);
    return NextResponse.json({ attachments });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Anhänge konnten nicht geladen werden",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const docId = String(formData.get("docId") || "").trim();
    const file = formData.get("file");

    if (!docId) {
      return NextResponse.json(
        { error: "docId ist erforderlich" },
        { status: 400 }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Keine PDF-Datei ausgewählt" },
        { status: 400 }
      );
    }

    const auth = await authorizePage(docId, true);
    if (!auth.ok) return auth.response;

    const attachment = await savePdfAttachment(docId, file, auth.user.name);
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "PDF-Upload fehlgeschlagen",
      },
      { status: 400 }
    );
  }
}
