import crypto from "node:crypto";
import {
  dbCreateToken,
  dbFindAndTouchToken,
  dbGetAgentBotDraftOnly,
  dbInsertDocument,
  dbInsertSpace,
  dbListTokens,
  dbReadWorkspace,
  dbRevokeToken,
  dbUpdateDocumentLocation,
  dbWriteWorkspace,
  type ApiTokenRecord,
  type PublicApiToken,
} from "./db";
import {
  compareDocumentsByTitle,
  type BriefDocument,
  type Space,
} from "./workspace";

export type { ApiTokenRecord, PublicApiToken };

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function readWorkspaceStore(): Promise<{
  spaces: Space[];
  documents: BriefDocument[];
}> {
  return dbReadWorkspace();
}

export async function writeWorkspaceContent(
  spaces: Space[],
  documents: BriefDocument[]
): Promise<{ spaces: Space[]; documents: BriefDocument[] }> {
  await dbWriteWorkspace(spaces, documents);
  return { spaces, documents };
}

export async function listApiTokens(): Promise<PublicApiToken[]> {
  return dbListTokens();
}

export async function createApiToken(name: string): Promise<{
  token: string;
  record: PublicApiToken;
}> {
  const cleanName = name.trim() || "Agent Token";
  const rawToken = `brief_${crypto.randomBytes(24).toString("hex")}`;
  const record: ApiTokenRecord = {
    id: `tok-${crypto.randomUUID().slice(0, 8)}`,
    name: cleanName,
    prefix: `${rawToken.slice(0, 12)}...`,
    hash: hashToken(rawToken),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  await dbCreateToken(record);

  return {
    token: rawToken,
    record: {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
    },
  };
}

export async function revokeApiToken(id: string): Promise<boolean> {
  return dbRevokeToken(id);
}

export async function verifyApiToken(
  rawToken: string | null | undefined
): Promise<{ valid: boolean; agentName?: string }> {
  const trimmed = rawToken?.trim();
  if (!trimmed) return { valid: false };

  const envToken = process.env.BRIEF_API_TOKEN?.trim();
  if (envToken && trimmed === envToken) {
    return { valid: true, agentName: "Env API Token" };
  }

  const name = await dbFindAndTouchToken(hashToken(trimmed));
  if (!name) return { valid: false };
  return { valid: true, agentName: name };
}

export async function createSpaceInStore(name: string): Promise<Space> {
  const cleanName = name.trim() || "New Space";
  const slug =
    cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "space";

  const { spaces } = await dbReadWorkspace();
  const existing = spaces.find((s) => s.slug === slug);
  if (existing) return existing;

  const space: Space = {
    id: `space-${crypto.randomUUID().slice(0, 8)}`,
    name: cleanName,
    slug,
  };
  await dbInsertSpace(space);
  return space;
}

/** Resolve a Space by ID, slug, or display name (case-insensitive). */
export function resolveSpace(
  spaces: Space[],
  spaceRef?: string
): Space | undefined {
  const ref = spaceRef?.trim().toLowerCase();
  if (!ref) return undefined;
  return spaces.find(
    (s) =>
      s.id.toLowerCase() === ref ||
      s.slug.toLowerCase() === ref ||
      s.name.toLowerCase() === ref
  );
}

/** Resolve a Document by ID or exact title (preferring `spaceId` when given). */
export function resolveDocument(
  documents: BriefDocument[],
  idOrTitle: string,
  spaceId?: string
): BriefDocument | undefined {
  const ref = idOrTitle.trim();
  if (!ref) return undefined;
  const byId = documents.find((d) => d.id === ref);
  if (byId) return byId;

  const lower = ref.toLowerCase();
  if (spaceId) {
    const inSpace = documents.find(
      (d) => d.spaceId === spaceId && d.title.toLowerCase() === lower
    );
    if (inSpace) return inSpace;
  }
  return documents.find((d) => d.title.toLowerCase() === lower);
}

function resolveParentId(
  documents: BriefDocument[],
  parentRef: string | null | undefined,
  spaceId: string,
  fallbackParentId: string | null
): { parentId: string | null } | { error: string } {
  if (parentRef === undefined) return { parentId: fallbackParentId };
  if (parentRef === null || parentRef.trim() === "") return { parentId: null };

  const parentDoc = resolveDocument(documents, parentRef, spaceId);
  if (!parentDoc) {
    return { error: `Parent document not found: ${parentRef}` };
  }
  if (parentDoc.spaceId !== spaceId) {
    return {
      error: `Parent document "${parentDoc.title}" belongs to a different space (${parentDoc.spaceId})`,
    };
  }
  return { parentId: parentDoc.id };
}

export interface ProposeDraftInput {
  title: string;
  content: string;
  spaceId?: string;
  targetDocId?: string;
  parentId?: string | null;
  proposedBy: string;
  summary?: string;
}

/**
 * Always creates a Draft document proposal. Never overwrites published docs.
 */
export async function proposeAgentDraft(
  input: ProposeDraftInput
): Promise<BriefDocument> {
  const { spaces, documents } = await dbReadWorkspace();
  const targetDoc = input.targetDocId
    ? resolveDocument(documents, input.targetDocId)
    : undefined;

  const matchedSpace = resolveSpace(spaces, input.spaceId);
  const resolvedSpaceId =
    targetDoc?.spaceId ||
    matchedSpace?.id ||
    spaces[0]?.id ||
    "space-brief";

  const parentResolution = resolveParentId(
    documents,
    input.parentId,
    resolvedSpaceId,
    targetDoc ? targetDoc.id : null
  );
  if ("error" in parentResolution) {
    throw new Error(parentResolution.error);
  }

  const draft: BriefDocument = {
    id: `doc-draft-${crypto.randomUUID().slice(0, 8)}`,
    spaceId: resolvedSpaceId,
    parentId: parentResolution.parentId,
    title:
      input.title.trim() ||
      (targetDoc ? `${targetDoc.title} (Draft)` : "Agent Draft"),
    content: input.content,
    updatedAt: new Date().toISOString(),
    status: "draft",
    proposedBy: input.proposedBy.trim() || "AI Agent",
    proposalTargetId: targetDoc?.id,
    proposalSummary: input.summary?.trim() || undefined,
    lastEditedBy: input.proposedBy.trim() || "AI Agent",
    lastEditedByType: "agent",
  };

  await dbInsertDocument(draft);
  return draft;
}

export interface CreateAgentDocInput {
  title: string;
  content: string;
  spaceId?: string;
  parentId?: string | null;
  authorName: string;
}

/**
 * Creates a document (supporting nested parentId). Respects the workspace
 * `agentBotDraftOnly` policy: creates a Draft when enabled, or an approved
 * published document when disabled.
 */
export async function createAgentDocument(
  input: CreateAgentDocInput
): Promise<{ doc: BriefDocument; draftOnly: boolean }> {
  const draftOnly = await dbGetAgentBotDraftOnly();
  if (draftOnly) {
    const draft = await proposeAgentDraft({
      title: input.title,
      content: input.content,
      spaceId: input.spaceId,
      parentId: input.parentId,
      proposedBy: input.authorName,
      summary: "Created via MCP create_doc (Draft-only policy active)",
    });
    return { doc: draft, draftOnly: true };
  }

  const { spaces, documents } = await dbReadWorkspace();
  const matchedSpace = resolveSpace(spaces, input.spaceId);
  const resolvedSpaceId = matchedSpace?.id || spaces[0]?.id || "space-brief";
  const parentResolution = resolveParentId(
    documents,
    input.parentId,
    resolvedSpaceId,
    null
  );
  if ("error" in parentResolution) {
    throw new Error(parentResolution.error);
  }

  const doc: BriefDocument = {
    id: `doc-${crypto.randomUUID().slice(0, 8)}`,
    spaceId: resolvedSpaceId,
    parentId: parentResolution.parentId,
    title: input.title.trim() || "Untitled Document",
    content: input.content,
    updatedAt: new Date().toISOString(),
    status: "approved",
    lastEditedBy: input.authorName.trim() || "AI Agent",
    lastEditedByType: "agent",
  };

  await dbInsertDocument(doc);
  return { doc, draftOnly: false };
}

/**
 * Moves or re-parents an existing document within or across Spaces.
 * Blocked when `agentBotDraftOnly` is enabled.
 */
export async function moveDocumentInStore(input: {
  idOrTitle: string;
  parentId?: string | null;
  spaceId?: string;
  authorName: string;
}): Promise<{ doc: BriefDocument } | { error: string }> {
  const draftOnly = await dbGetAgentBotDraftOnly();
  if (draftOnly) {
    return {
      error:
        "Agent-Bot Policy is set to Draft-only ('Nur Drafts'). Disable it in Team & Rechte to allow moving documents via MCP.",
    };
  }

  const { spaces, documents } = await dbReadWorkspace();
  const doc = resolveDocument(documents, input.idOrTitle);
  if (!doc) {
    return { error: `Document not found: ${input.idOrTitle}` };
  }

  const targetSpace = input.spaceId
    ? resolveSpace(spaces, input.spaceId)
    : spaces.find((s) => s.id === doc.spaceId);
  if (input.spaceId && !targetSpace) {
    return { error: `Space not found: ${input.spaceId}` };
  }
  const nextSpaceId = targetSpace?.id ?? doc.spaceId;

  const fallbackParent = nextSpaceId === doc.spaceId ? (doc.parentId ?? null) : null;
  const parentResolution = resolveParentId(
    documents,
    input.parentId,
    nextSpaceId,
    fallbackParent
  );
  if ("error" in parentResolution) {
    return { error: parentResolution.error };
  }
  const nextParentId = parentResolution.parentId;

  // Prevent self-parenting and cycles
  if (nextParentId === doc.id) {
    return { error: "A document cannot be its own parent." };
  }
  let cursor = nextParentId;
  const visited = new Set<string>([doc.id]);
  while (cursor) {
    if (visited.has(cursor)) {
      return { error: "Circular parent hierarchy is not allowed." };
    }
    visited.add(cursor);
    const ancestor = documents.find((d) => d.id === cursor);
    cursor = ancestor?.parentId ?? null;
  }

  const updatedAt = new Date().toISOString();
  const lastEditedBy = input.authorName.trim() || "AI Agent";
  await dbUpdateDocumentLocation(
    doc.id,
    nextSpaceId,
    nextParentId,
    updatedAt,
    lastEditedBy
  );

  return {
    doc: {
      ...doc,
      spaceId: nextSpaceId,
      parentId: nextParentId,
      updatedAt,
      lastEditedBy,
      lastEditedByType: "agent",
    },
  };
}

export interface DocumentTreeNode {
  id: string;
  title: string;
  spaceId: string;
  parentId: string | null;
  status: string;
  updatedAt: string;
  children: DocumentTreeNode[];
}

/** Build a nested document tree per Space for MCP inspection. */
export function buildSpaceDocumentTree(
  spaces: Space[],
  documents: BriefDocument[],
  options?: { spaceRef?: string; includeDrafts?: boolean }
): Array<{ id: string; name: string; slug: string; documents: DocumentTreeNode[] }> {
  const targetSpaces = options?.spaceRef
    ? spaces.filter((s) => resolveSpace([s], options.spaceRef) !== undefined)
    : spaces;

  return targetSpaces.map((space) => {
    const spaceDocs = documents.filter(
      (d) =>
        d.spaceId === space.id &&
        (options?.includeDrafts || d.status !== "draft")
    );
    const spaceDocIds = new Set(spaceDocs.map((d) => d.id));
    const nodeMap = new Map<string, DocumentTreeNode>();

    for (const d of spaceDocs) {
      const normalizedParent =
        d.parentId && spaceDocIds.has(d.parentId) ? d.parentId : null;
      nodeMap.set(d.id, {
        id: d.id,
        title: d.title,
        spaceId: d.spaceId,
        parentId: normalizedParent,
        status: d.status ?? "approved",
        updatedAt: d.updatedAt,
        children: [],
      });
    }

    const roots: DocumentTreeNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    roots.sort(compareDocumentsByTitle);
    for (const node of nodeMap.values()) {
      node.children.sort(compareDocumentsByTitle);
    }

    return {
      id: space.id,
      name: space.name,
      slug: space.slug,
      documents: roots,
    };
  });
}

export function isAdrOrSpecDocument(doc: BriefDocument): boolean {
  const haystack = `${doc.title}\n${doc.content.slice(0, 600)}`.toLowerCase();
  return (
    /\badr\b/.test(haystack) ||
    haystack.includes("architecture") ||
    haystack.includes("decision") ||
    haystack.includes("spec") ||
    haystack.includes("rfc")
  );
}
