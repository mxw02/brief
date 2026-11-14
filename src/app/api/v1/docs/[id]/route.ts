import { NextResponse, type NextRequest } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { buildAgentContextMarkdown } from "@/lib/agent-context";
import { parseFrontmatter } from "@/lib/frontmatter";
import { readWorkspaceStore } from "@/lib/server-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAgentAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const includeContext = searchParams.get("context") === "true";

  const { spaces, documents } = await readWorkspaceStore();
  const doc = documents.find(
    (d) =>
      d.id === id || d.title.toLowerCase() === decodeURIComponent(id).toLowerCase()
  );

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const space = spaces.find((s) => s.id === doc.spaceId);
  const { metadata } = parseFrontmatter(doc.content);

  return NextResponse.json({
    document: {
      ...doc,
      status: doc.status ?? "approved",
      spaceName: space?.name ?? "Space",
      metadata,
    },
    ...(includeContext
      ? {
          agentContextMarkdown: buildAgentContextMarkdown(
            doc,
            documents,
            spaces,
            { sameSpaceOnly: true }
          ),
        }
      : {}),
  });
}
