import { NextResponse, type NextRequest } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import {
  matchesFrontmatterFilter,
  parseFrontmatter,
} from "@/lib/frontmatter";
import { buildSearchIndex, searchDocuments } from "@/lib/search-index";
import { isAdrOrSpecDocument, readWorkspaceStore } from "@/lib/server-store";
import { normalizeDocumentStatus, SPEC_STATUSES } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  const auth = await requireAgentAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const spaceFilter = searchParams.get("space")?.trim().toLowerCase() || "";
  const statusFilter = searchParams.get("status")?.trim().toLowerCase() || "";
  const typeFilter = searchParams.get("type")?.trim().toLowerCase() || "";
  const ownerFilter = searchParams.get("owner")?.trim() || "";
  const scopeFilter = searchParams.get("scope")?.trim() || "";
  const techStackFilter = searchParams.get("techStack")?.trim() || "";

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

  if (statusFilter) {
    const normalizedFilter =
      statusFilter === "published" ? "approved" : statusFilter;
    if (SPEC_STATUSES.includes(normalizedFilter as (typeof SPEC_STATUSES)[number])) {
      filtered = filtered.filter(
        (doc) => normalizeDocumentStatus(doc.status) === normalizedFilter
      );
    }
  }

  if (typeFilter === "adr" || typeFilter === "spec") {
    filtered = filtered.filter((doc) => isAdrOrSpecDocument(doc));
  }

  if (ownerFilter || scopeFilter || techStackFilter) {
    filtered = filtered.filter((doc) => {
      const { metadata } = parseFrontmatter(doc.content);
      if (ownerFilter && !matchesFrontmatterFilter(metadata, "owner", ownerFilter)) {
        return false;
      }
      if (scopeFilter && !matchesFrontmatterFilter(metadata, "scope", scopeFilter)) {
        return false;
      }
      if (
        techStackFilter &&
        !matchesFrontmatterFilter(metadata, "tech-stack", techStackFilter)
      ) {
        return false;
      }
      return true;
    });
  }

  return NextResponse.json({
    count: filtered.length,
    documents: filtered.map((doc) => {
      const { metadata, body } = parseFrontmatter(doc.content);
      return {
        id: doc.id,
        title: doc.title,
        spaceId: doc.spaceId,
        spaceName: spaceMap.get(doc.spaceId)?.name ?? "Space",
        parentId: doc.parentId,
        status: normalizeDocumentStatus(doc.status),
        metadata,
        proposedBy: doc.proposedBy ?? null,
        proposalTargetId: doc.proposalTargetId ?? null,
        updatedAt: doc.updatedAt,
        isAdrOrSpec: isAdrOrSpecDocument(doc),
        excerpt: body.slice(0, 220),
      };
    }),
  });
}
