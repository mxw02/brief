import { NextResponse, type NextRequest } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { readWorkspaceStore } from "@/lib/server-store";

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
