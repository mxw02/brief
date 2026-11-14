import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_DOCUMENTS,
  DEFAULT_SPACES,
  type BriefDocument,
  type Space,
} from "./workspace";

export interface ApiTokenRecord {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PublicApiToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface WorkspaceStoreData {
  spaces: Space[];
  documents: BriefDocument[];
  tokens: ApiTokenRecord[];
}

function getStoreFilePath(): string {
  const dataDir =
    process.env.BRIEF_DATA_DIR?.trim() ||
    path.join(process.cwd(), ".brief-data");
  return path.join(dataDir, "workspace.json");
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function createInitialStore(): WorkspaceStoreData {
  return {
    spaces: DEFAULT_SPACES,
    documents: DEFAULT_DOCUMENTS.map((doc) => ({
      ...doc,
      status: doc.status ?? "published",
    })),
    tokens: [],
  };
}

// Serialize writes in-process so concurrent API/MCP calls do not race on disk
let writeQueue: Promise<unknown> = Promise.resolve();

function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => undefined);
  return next;
}

async function readRawStore(): Promise<WorkspaceStoreData> {
  const filePath = getStoreFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkspaceStoreData>;
    return {
      spaces:
        Array.isArray(parsed.spaces) && parsed.spaces.length > 0
          ? parsed.spaces
          : DEFAULT_SPACES,
      documents:
        Array.isArray(parsed.documents) && parsed.documents.length > 0
          ? parsed.documents
          : DEFAULT_DOCUMENTS,
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
    };
  } catch {
    const initial = createInitialStore();
    await writeRawStore(initial);
    return initial;
  }
}

async function writeRawStore(data: WorkspaceStoreData): Promise<void> {
  const filePath = getStoreFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
}

export async function readWorkspaceStore(): Promise<{
  spaces: Space[];
  documents: BriefDocument[];
}> {
  const store = await readRawStore();
  return {
    spaces: store.spaces,
    documents: store.documents,
  };
}

export async function writeWorkspaceContent(
  spaces: Space[],
  documents: BriefDocument[]
): Promise<{ spaces: Space[]; documents: BriefDocument[] }> {
  return withStoreLock(async () => {
    const store = await readRawStore();
    const updated: WorkspaceStoreData = {
      spaces,
      documents,
      tokens: store.tokens,
    };
    await writeRawStore(updated);
    return { spaces: updated.spaces, documents: updated.documents };
  });
}

export async function listApiTokens(): Promise<PublicApiToken[]> {
  const store = await readRawStore();
  return store.tokens.map(({ id, name, prefix, createdAt, lastUsedAt }) => ({
    id,
    name,
    prefix,
    createdAt,
    lastUsedAt,
  }));
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

  await withStoreLock(async () => {
    const store = await readRawStore();
    store.tokens.unshift(record);
    await writeRawStore(store);
  });

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
  return withStoreLock(async () => {
    const store = await readRawStore();
    const before = store.tokens.length;
    store.tokens = store.tokens.filter((t) => t.id !== id);
    if (store.tokens.length === before) return false;
    await writeRawStore(store);
    return true;
  });
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

  const digest = hashToken(trimmed);
  return withStoreLock(async () => {
    const store = await readRawStore();
    const match = store.tokens.find((t) => t.hash === digest);
    if (!match) return { valid: false };
    match.lastUsedAt = new Date().toISOString();
    await writeRawStore(store);
    return { valid: true, agentName: match.name };
  });
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
  return withStoreLock(async () => {
    const store = await readRawStore();
    const targetDoc = input.targetDocId
      ? store.documents.find((d) => d.id === input.targetDocId)
      : undefined;

    const resolvedSpaceId =
      targetDoc?.spaceId ||
      (input.spaceId && store.spaces.some((s) => s.id === input.spaceId)
        ? input.spaceId
        : store.spaces[0]?.id || "space-eng");

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
      title: input.title.trim() || (targetDoc ? `${targetDoc.title} (Draft)` : "Agent Draft"),
      content: input.content,
      updatedAt: new Date().toISOString(),
      status: "draft",
      proposedBy: input.proposedBy.trim() || "AI Agent",
      proposalTargetId: targetDoc?.id,
      proposalSummary: input.summary?.trim() || undefined,
    };

    store.documents.push(draft);
    await writeRawStore(store);
    return draft;
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
