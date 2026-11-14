import crypto from "node:crypto";
import {
  dbCreateToken,
  dbFindAndTouchToken,
  dbInsertDocument,
  dbInsertSpace,
  dbListTokens,
  dbReadWorkspace,
  dbRevokeToken,
  dbWriteWorkspace,
  type ApiTokenRecord,
  type PublicApiToken,
} from "./db";
import type { BriefDocument, Space } from "./workspace";

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
    ? documents.find((d) => d.id === input.targetDocId)
    : undefined;

  const resolvedSpaceId =
    targetDoc?.spaceId ||
    (input.spaceId && spaces.some((s) => s.id === input.spaceId)
      ? input.spaceId
      : spaces[0]?.id || "space-eng");

  const resolvedParentId =
    input.parentId !== undefined
      ? input.parentId
      : targetDoc
        ? targetDoc.id
        : null;

  const draft: BriefDocument = {
    id: `doc-draft-${crypto.randomUUID().slice(0, 8)}`,
    spaceId: resolvedSpaceId,
    parentId: resolvedParentId,
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
