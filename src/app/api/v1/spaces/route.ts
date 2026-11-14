import { NextResponse, type NextRequest } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { createSpaceInStore, readWorkspaceStore } from "@/lib/server-store";

export async function GET(request: NextRequest) {
  const auth = await requireAgentAuth(request);
  if (!auth.ok) return auth.response;

  const { spaces, documents } = await readWorkspaceStore();
  const payload = spaces.map((space) => ({
    ...space,
    documentCount: documents.filter((d) => d.spaceId === space.id).length,
    draftCount: documents.filter(
      (d) => d.spaceId === space.id && d.status === "draft"
    ).length,
  }));

  return NextResponse.json({ spaces: payload });
}

export async function POST(request: NextRequest) {
  const auth = await requireAgentAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }
    const space = await createSpaceInStore(body.name);
    return NextResponse.json({ space }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
}
