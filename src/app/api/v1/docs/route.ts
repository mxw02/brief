import { NextResponse, type NextRequest } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { buildSearchIndex, searchDocuments } from "@/lib/search-index";
import { isAdrOrSpecDocument, readWorkspaceStore } from "@/lib/server-store";

export async function GET(request: NextRequest) {
  const auth = await requireAgentAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const spaceFilter = searchParams.get("space")?.trim().toLowerCase() || "";
  const statusFilter = searchParams.get("status")?.trim().toLowerCase() || "";
  const typeFilter = searchParams.get("type")?.trim().toLowerCase() || "";

  const { spaces, documents } = await readWorkspaceStore();
  const spaceMap = new Map(spaces.map((s) => [s.id, s]));

  let filtered = documents;

  if (query) {
    const index = buildSearchIndex(documents, spaces);
    const { results } = searchDocuments(index, query);
    filtered = results.map((r) => r.doc);
  }

  if (spaceFilter) {
    filtered = filtered.filter((doc) => {
      const sp = spaceMap.get(doc.spaceId);
      return (
        doc.spaceId.toLowerCase() === spaceFilter ||
        sp?.slug.toLowerCase() === spaceFilter ||
        sp?.name.toLowerCase() === spaceFilter
      );
    });
  }

  if (statusFilter === "draft" || statusFilter === "published") {
    filtered = filtered.filter(
      (doc) => (doc.status ?? "published") === statusFilter
    );
  }

  if (typeFilter === "adr" || typeFilter === "spec") {
    filtered = filtered.filter((doc) => isAdrOrSpecDocument(doc));
  }

  return NextResponse.json({
    count: filtered.length,
    documents: filtered.map((doc) => ({
      id: doc.id,
      title: doc.title,
      spaceId: doc.spaceId,
      spaceName: spaceMap.get(doc.spaceId)?.name ?? "Space",
      parentId: doc.parentId,
      status: doc.status ?? "published",
      proposedBy: doc.proposedBy ?? null,
      proposalTargetId: doc.proposalTargetId ?? null,
      updatedAt: doc.updatedAt,
      isAdrOrSpec: isAdrOrSpecDocument(doc),
      excerpt: doc.content.slice(0, 220),
    })),
  });
}
