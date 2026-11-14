import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessSpace,
  canEditDocuments,
  getSessionUser,
} from "@/lib/auth";
import { readWorkspaceStore, writeWorkspaceContent } from "@/lib/server-store";
import type { BriefDocument, Space } from "@/lib/workspace";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await readWorkspaceStore();
  const visibleSpaces = data.spaces.filter((s) => canAccessSpace(user, s.id));
  const visibleSpaceIds = new Set(visibleSpaces.map((s) => s.id));
  const visibleDocs = data.documents.filter((d) =>
    visibleSpaceIds.has(d.spaceId)
  );

  return NextResponse.json({
    spaces: visibleSpaces,
    documents: visibleDocs,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEditDocuments(user)) {
    return NextResponse.json(
      { error: "Viewer haben nur Lesezugriff" },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      spaces?: Space[];
      documents?: BriefDocument[];
    };
    if (!Array.isArray(body.spaces) || !Array.isArray(body.documents)) {
      return NextResponse.json(
        { error: "Invalid workspace payload" },
        { status: 400 }
      );
    }

    const existing = await readWorkspaceStore();
    const existingDocMap = new Map(existing.documents.map((d) => [d.id, d]));

    const stampHumanEdits = (docs: BriefDocument[]): BriefDocument[] =>
      docs.map((doc) => {
        const prev = existingDocMap.get(doc.id);
        const changed =
          !prev ||
          prev.content !== doc.content ||
          prev.title !== doc.title ||
          prev.status !== doc.status;
        if (!changed) {
          return {
            ...doc,
            lastEditedBy: doc.lastEditedBy ?? prev?.lastEditedBy ?? null,
            lastEditedByType:
              doc.lastEditedByType ?? prev?.lastEditedByType ?? null,
          };
        }
        return {
          ...doc,
          lastEditedBy: user.name,
          lastEditedByType: "human",
        };
      });

    if (user.role === "admin") {
      const saved = await writeWorkspaceContent(
        body.spaces,
        stampHumanEdits(body.documents)
      );
      return NextResponse.json(saved);
    }

    // Editor: only persist changes inside spaces the user can access, preserving hidden spaces/docs
    const allowedIncomingSpaces = body.spaces.filter((s) =>
      canAccessSpace(user, s.id)
    );
    const allowedSpaceIds = new Set(allowedIncomingSpaces.map((s) => s.id));
    const hiddenSpaces = existing.spaces.filter(
      (s) => !canAccessSpace(user, s.id)
    );
    const hiddenSpaceIds = new Set(hiddenSpaces.map((s) => s.id));
    const hiddenDocs = existing.documents.filter((d) =>
      hiddenSpaceIds.has(d.spaceId)
    );
    const allowedIncomingDocs = stampHumanEdits(
      body.documents.filter((d) => allowedSpaceIds.has(d.spaceId))
    );

    await writeWorkspaceContent(
      [...allowedIncomingSpaces, ...hiddenSpaces],
      [...allowedIncomingDocs, ...hiddenDocs]
    );

    return NextResponse.json({
      spaces: allowedIncomingSpaces,
      documents: allowedIncomingDocs,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to persist workspace" },
      { status: 400 }
    );
  }
}
