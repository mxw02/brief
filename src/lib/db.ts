import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import {
  compareDocumentsByTitle,
  DEFAULT_DOCUMENTS,
  DEFAULT_SPACES,
  normalizeDocumentStatus,
  type AuthorType,
  type BriefDocument,
  type InlineComment,
  type PublicUser,
  type Space,
  type UserRole,
} from "./workspace";

export type DatabaseDriver = "sqlite" | "postgres";

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

interface SqliteStatement {
  run: (...params: unknown[]) => { changes?: number | bigint };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

export function getDatabaseDriver(): DatabaseDriver {
  const url = process.env.DATABASE_URL?.trim() || "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }
  return "sqlite";
}

export function getDataDir(): string {
  return (
    process.env.BRIEF_DATA_DIR?.trim() || path.join(process.cwd(), ".brief-data")
  );
}

function getSqlitePath(): string {
  const url = process.env.DATABASE_URL?.trim() || "";
  if (url.startsWith("file:")) {
    return url.slice("file:".length);
  }
  if (url.startsWith("sqlite:")) {
    return url.slice("sqlite:".length);
  }
  return path.join(getDataDir(), "brief.db");
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  proposed_by TEXT,
  proposal_target_id TEXT,
  proposal_summary TEXT,
  comments_json TEXT
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  all_spaces INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_space_access (
  user_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  PRIMARY KEY (user_id, space_id)
);

CREATE TABLE IF NOT EXISTS workspace_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let sqliteInstance: SqliteDatabase | null = null;
let pgPool: Pool | null = null;
let initPromise: Promise<void> | null = null;

async function getSqlite(): Promise<SqliteDatabase> {
  if (sqliteInstance) return sqliteInstance;
  const dbPath = getSqlitePath();
  if (dbPath !== ":memory:") {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
  }
  // Load built-in node:sqlite dynamically so PostgreSQL deployments never touch it
  const mod = (await import("node:sqlite")) as unknown as {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
  sqliteInstance = new mod.DatabaseSync(dbPath);
  sqliteInstance.exec("PRAGMA journal_mode = WAL;");
  sqliteInstance.exec(SCHEMA_SQL);
  return sqliteInstance;
}

function getPgPool(): Pool {
  if (pgPool) return pgPool;
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  return pgPool;
}

async function readLegacyJsonSeed(): Promise<{
  spaces: Space[];
  documents: BriefDocument[];
  tokens: ApiTokenRecord[];
} | null> {
  try {
    const raw = await fs.readFile(
      path.join(getDataDir(), "workspace.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw) as {
      spaces?: Space[];
      documents?: BriefDocument[];
      tokens?: ApiTokenRecord[];
    };
    if (parsed.spaces?.length && parsed.documents?.length) {
      return {
        spaces: parsed.spaces,
        documents: parsed.documents,
        tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      };
    }
  } catch {
    // No legacy workspace.json present
  }
  return null;
}

async function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const driver = getDatabaseDriver();

    if (driver === "postgres") {
      const pool = getPgPool();
      await pool.query(SCHEMA_SQL);
      await pool.query(
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS comments_json TEXT"
      );
      await pool.query(
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_edited_by TEXT"
      );
      await pool.query(
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS last_edited_by_type TEXT"
      );
      const res = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM spaces"
      );
      if (Number(res.rows[0]?.count || "0") === 0) {
        const legacy = await readLegacyJsonSeed();
        const seedSpaces = legacy?.spaces ?? DEFAULT_SPACES;
        const seedDocs = legacy?.documents ?? DEFAULT_DOCUMENTS;
        const seedTokens = legacy?.tokens ?? [];

        for (const s of seedSpaces) {
          await pool.query(
            "INSERT INTO spaces (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
            [s.id, s.name, s.slug]
          );
        }
        for (const d of seedDocs) {
          await pool.query(
            `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [
              d.id,
              d.spaceId,
              d.parentId ?? null,
              d.title,
              d.content,
              d.updatedAt,
              d.status ?? "published",
              d.proposedBy ?? null,
              d.proposalTargetId ?? null,
              d.proposalSummary ?? null,
            ]
          );
        }
        for (const t of seedTokens) {
          await pool.query(
            `INSERT INTO api_tokens (id, name, prefix, hash, created_at, last_used_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [t.id, t.name, t.prefix, t.hash, t.createdAt, t.lastUsedAt ?? null]
          );
        }
      }
      return;
    }

    const db = await getSqlite();
    const cols = db.prepare("PRAGMA table_info(documents)").all();
    if (!cols.some((c) => c.name === "comments_json")) {
      db.exec("ALTER TABLE documents ADD COLUMN comments_json TEXT;");
    }
    if (!cols.some((c) => c.name === "last_edited_by")) {
      db.exec("ALTER TABLE documents ADD COLUMN last_edited_by TEXT;");
    }
    if (!cols.some((c) => c.name === "last_edited_by_type")) {
      db.exec("ALTER TABLE documents ADD COLUMN last_edited_by_type TEXT;");
    }
    const row = db.prepare("SELECT COUNT(*) AS count FROM spaces").get();
    if (Number(row?.count ?? 0) === 0) {
      const legacy = await readLegacyJsonSeed();
      const seedSpaces = legacy?.spaces ?? DEFAULT_SPACES;
      const seedDocs = legacy?.documents ?? DEFAULT_DOCUMENTS;
      const seedTokens = legacy?.tokens ?? [];

      const insertSpace = db.prepare(
        "INSERT OR IGNORE INTO spaces (id, name, slug) VALUES (?, ?, ?)"
      );
      for (const s of seedSpaces) {
        insertSpace.run(s.id, s.name, s.slug);
      }

      const insertDoc = db.prepare(
        `INSERT OR IGNORE INTO documents
         (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const d of seedDocs) {
        insertDoc.run(
          d.id,
          d.spaceId,
          d.parentId ?? null,
          d.title,
          d.content,
          d.updatedAt,
          d.status ?? "published",
          d.proposedBy ?? null,
          d.proposalTargetId ?? null,
          d.proposalSummary ?? null
        );
      }

      const insertTok = db.prepare(
        `INSERT OR IGNORE INTO api_tokens (id, name, prefix, hash, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const t of seedTokens) {
        insertTok.run(
          t.id,
          t.name,
          t.prefix,
          t.hash,
          t.createdAt,
          t.lastUsedAt ?? null
        );
      }
    }
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

function parseCommentsJson(raw: unknown): InlineComment[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as InlineComment[])
      : undefined;
  } catch {
    return undefined;
  }
}

function mapDocRow(row: Record<string, unknown>): BriefDocument {
  const comments = parseCommentsJson(row.comments_json);
  const editedType =
    row.last_edited_by_type === "agent" || row.last_edited_by_type === "human"
      ? (row.last_edited_by_type as AuthorType)
      : undefined;
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    title: String(row.title),
    content: String(row.content),
    updatedAt: String(row.updated_at),
    status: normalizeDocumentStatus(row.status ? String(row.status) : null),
    ...(row.proposed_by ? { proposedBy: String(row.proposed_by) } : {}),
    ...(row.proposal_target_id
      ? { proposalTargetId: String(row.proposal_target_id) }
      : {}),
    ...(row.proposal_summary
      ? { proposalSummary: String(row.proposal_summary) }
      : {}),
    ...(row.last_edited_by
      ? { lastEditedBy: String(row.last_edited_by) }
      : {}),
    ...(editedType ? { lastEditedByType: editedType } : {}),
    ...(comments ? { comments } : {}),
  };
}

export async function checkDatabaseHealth(): Promise<{
  driver: DatabaseDriver;
  status: "connected";
}> {
  await ensureInitialized();
  const driver = getDatabaseDriver();
  if (driver === "postgres") {
    await getPgPool().query("SELECT 1");
  } else {
    const db = await getSqlite();
    db.prepare("SELECT 1 AS ok").get();
  }
  return { driver, status: "connected" };
}

export async function dbReadWorkspace(): Promise<{
  spaces: Space[];
  documents: BriefDocument[];
}> {
  await ensureInitialized();
  const driver = getDatabaseDriver();

  if (driver === "postgres") {
    const pool = getPgPool();
    const [spacesRes, docsRes] = await Promise.all([
      pool.query<Record<string, unknown>>(
        "SELECT id, name, slug FROM spaces ORDER BY name ASC, id ASC"
      ),
      pool.query<Record<string, unknown>>(
        "SELECT id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary, last_edited_by, last_edited_by_type, comments_json FROM documents"
      ),
    ]);
    return {
      spaces: spacesRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
      })),
      documents: docsRes.rows.map(mapDocRow).sort(compareDocumentsByTitle),
    };
  }

  const db = await getSqlite();
  const spaces = db
    .prepare("SELECT id, name, slug FROM spaces ORDER BY name ASC, id ASC")
    .all()
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
    }));
  const documents = db
    .prepare(
      "SELECT id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary, last_edited_by, last_edited_by_type, comments_json FROM documents"
    )
    .all()
    .map(mapDocRow)
    .sort(compareDocumentsByTitle);

  return { spaces, documents };
}

export async function dbWriteWorkspace(
  spaces: Space[],
  documents: BriefDocument[]
): Promise<void> {
  await ensureInitialized();
  const driver = getDatabaseDriver();

  if (driver === "postgres") {
    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM documents");
      await client.query("DELETE FROM spaces");
      for (const s of spaces) {
        await client.query(
          "INSERT INTO spaces (id, name, slug) VALUES ($1, $2, $3)",
          [s.id, s.name, s.slug]
        );
      }
      for (const d of documents) {
        await client.query(
          `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary, last_edited_by, last_edited_by_type, comments_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            d.id,
            d.spaceId,
            d.parentId ?? null,
            d.title,
            d.content,
            d.updatedAt,
            d.status ?? "approved",
            d.proposedBy ?? null,
            d.proposalTargetId ?? null,
            d.proposalSummary ?? null,
            d.lastEditedBy ?? null,
            d.lastEditedByType ?? null,
            d.comments?.length ? JSON.stringify(d.comments) : null,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return;
  }

  const db = await getSqlite();
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM documents");
    db.exec("DELETE FROM spaces");
    const insertSpace = db.prepare(
      "INSERT INTO spaces (id, name, slug) VALUES (?, ?, ?)"
    );
    for (const s of spaces) {
      insertSpace.run(s.id, s.name, s.slug);
    }
    const insertDoc = db.prepare(
      `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary, last_edited_by, last_edited_by_type, comments_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of documents) {
      insertDoc.run(
        d.id,
        d.spaceId,
        d.parentId ?? null,
        d.title,
        d.content,
        d.updatedAt,
        d.status ?? "approved",
        d.proposedBy ?? null,
        d.proposalTargetId ?? null,
        d.proposalSummary ?? null,
        d.lastEditedBy ?? null,
        d.lastEditedByType ?? null,
        d.comments?.length ? JSON.stringify(d.comments) : null
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export async function dbInsertSpace(space: Space): Promise<void> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    await getPgPool().query(
      "INSERT INTO spaces (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
      [space.id, space.name, space.slug]
    );
    return;
  }
  const db = await getSqlite();
  db.prepare(
    "INSERT OR IGNORE INTO spaces (id, name, slug) VALUES (?, ?, ?)"
  ).run(space.id, space.name, space.slug);
}

export async function dbInsertDocument(doc: BriefDocument): Promise<void> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    await getPgPool().query(
      `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary, last_edited_by, last_edited_by_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        doc.id,
        doc.spaceId,
        doc.parentId ?? null,
        doc.title,
        doc.content,
        doc.updatedAt,
        doc.status ?? "approved",
        doc.proposedBy ?? null,
        doc.proposalTargetId ?? null,
        doc.proposalSummary ?? null,
        doc.lastEditedBy ?? null,
        doc.lastEditedByType ?? null,
      ]
    );
    return;
  }
  const db = await getSqlite();
  db.prepare(
    `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary, last_edited_by, last_edited_by_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    doc.id,
    doc.spaceId,
    doc.parentId ?? null,
    doc.title,
    doc.content,
    doc.updatedAt,
    doc.status ?? "approved",
    doc.proposedBy ?? null,
    doc.proposalTargetId ?? null,
    doc.proposalSummary ?? null,
    doc.lastEditedBy ?? null,
    doc.lastEditedByType ?? null
  );
}

/** Update a document's space and parent placement (for nested hierarchy moves). */
export async function dbUpdateDocumentLocation(
  id: string,
  spaceId: string,
  parentId: string | null,
  updatedAt: string,
  lastEditedBy: string
): Promise<void> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    await getPgPool().query(
      `UPDATE documents
       SET space_id = $1, parent_id = $2, updated_at = $3, last_edited_by = $4, last_edited_by_type = 'agent'
       WHERE id = $5`,
      [spaceId, parentId, updatedAt, lastEditedBy, id]
    );
    return;
  }
  const db = await getSqlite();
  db.prepare(
    `UPDATE documents
     SET space_id = ?, parent_id = ?, updated_at = ?, last_edited_by = ?, last_edited_by_type = 'agent'
     WHERE id = ?`
  ).run(spaceId, parentId, updatedAt, lastEditedBy, id);
}

export async function dbListTokens(): Promise<PublicApiToken[]> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    const res = await getPgPool().query<Record<string, unknown>>(
      "SELECT id, name, prefix, created_at, last_used_at FROM api_tokens ORDER BY created_at DESC"
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      prefix: String(r.prefix),
      createdAt: String(r.created_at),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    }));
  }
  const db = await getSqlite();
  return db
    .prepare(
      "SELECT id, name, prefix, created_at, last_used_at FROM api_tokens ORDER BY created_at DESC"
    )
    .all()
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      prefix: String(r.prefix),
      createdAt: String(r.created_at),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    }));
}

export async function dbCreateToken(record: ApiTokenRecord): Promise<void> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    await getPgPool().query(
      "INSERT INTO api_tokens (id, name, prefix, hash, created_at, last_used_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        record.id,
        record.name,
        record.prefix,
        record.hash,
        record.createdAt,
        record.lastUsedAt,
      ]
    );
    return;
  }
  const db = await getSqlite();
  db.prepare(
    "INSERT INTO api_tokens (id, name, prefix, hash, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    record.id,
    record.name,
    record.prefix,
    record.hash,
    record.createdAt,
    record.lastUsedAt
  );
}

export async function dbRevokeToken(id: string): Promise<boolean> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    const res = await getPgPool().query(
      "DELETE FROM api_tokens WHERE id = $1",
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }
  const db = await getSqlite();
  const res = db.prepare("DELETE FROM api_tokens WHERE id = ?").run(id);
  return Number(res.changes ?? 0) > 0;
}

export async function dbFindAndTouchToken(
  hash: string
): Promise<string | null> {
  await ensureInitialized();
  const now = new Date().toISOString();
  if (getDatabaseDriver() === "postgres") {
    const res = await getPgPool().query<{ id: string; name: string }>(
      "UPDATE api_tokens SET last_used_at = $1 WHERE hash = $2 RETURNING id, name",
      [now, hash]
    );
    return res.rows[0]?.name ?? null;
  }
  const db = await getSqlite();
  const row = db
    .prepare("SELECT id, name FROM api_tokens WHERE hash = ?")
    .get(hash);
  if (!row) return null;
  db.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(
    now,
    String(row.id)
  );
  return String(row.name);
}

function normalizeUserRole(role: unknown): UserRole {
  if (role === "admin" || role === "editor" || role === "viewer" || role === "agent_bot") {
    return role;
  }
  return "viewer";
}

export async function dbCountUsers(): Promise<number> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    const res = await getPgPool().query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM users"
    );
    return Number(res.rows[0]?.count || "0");
  }
  const db = await getSqlite();
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  return Number(row?.count ?? 0);
}

export async function dbListUsers(): Promise<PublicUser[]> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    const pool = getPgPool();
    const [usersRes, accessRes] = await Promise.all([
      pool.query<Record<string, unknown>>(
        "SELECT id, name, email, role, all_spaces, created_at FROM users ORDER BY created_at ASC"
      ),
      pool.query<Record<string, unknown>>(
        "SELECT user_id, space_id FROM user_space_access"
      ),
    ]);
    const accessMap = new Map<string, string[]>();
    for (const r of accessRes.rows) {
      const uid = String(r.user_id);
      const list = accessMap.get(uid) ?? [];
      list.push(String(r.space_id));
      accessMap.set(uid, list);
    }
    return usersRes.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      role: normalizeUserRole(r.role),
      allSpaces: Number(r.all_spaces) === 1,
      spaceIds: accessMap.get(String(r.id)) ?? [],
      createdAt: String(r.created_at),
    }));
  }

  const db = await getSqlite();
  const userRows = db
    .prepare(
      "SELECT id, name, email, role, all_spaces, created_at FROM users ORDER BY created_at ASC"
    )
    .all();
  const accessRows = db
    .prepare("SELECT user_id, space_id FROM user_space_access")
    .all();
  const accessMap = new Map<string, string[]>();
  for (const r of accessRows) {
    const uid = String(r.user_id);
    const list = accessMap.get(uid) ?? [];
    list.push(String(r.space_id));
    accessMap.set(uid, list);
  }
  return userRows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    role: normalizeUserRole(r.role),
    allSpaces: Number(r.all_spaces) === 1,
    spaceIds: accessMap.get(String(r.id)) ?? [],
    createdAt: String(r.created_at),
  }));
}

export async function dbFindUserByEmail(
  email: string
): Promise<(PublicUser & { passwordHash: string }) | null> {
  await ensureInitialized();
  const normalized = email.trim().toLowerCase();
  if (getDatabaseDriver() === "postgres") {
    const pool = getPgPool();
    const res = await pool.query<Record<string, unknown>>(
      "SELECT id, name, email, password_hash, role, all_spaces, created_at FROM users WHERE email = $1",
      [normalized]
    );
    const row = res.rows[0];
    if (!row) return null;
    const accessRes = await pool.query<Record<string, unknown>>(
      "SELECT space_id FROM user_space_access WHERE user_id = $1",
      [String(row.id)]
    );
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      passwordHash: String(row.password_hash),
      role: normalizeUserRole(row.role),
      allSpaces: Number(row.all_spaces) === 1,
      spaceIds: accessRes.rows.map((r) => String(r.space_id)),
      createdAt: String(row.created_at),
    };
  }

  const db = await getSqlite();
  const row = db
    .prepare(
      "SELECT id, name, email, password_hash, role, all_spaces, created_at FROM users WHERE email = ?"
    )
    .get(normalized);
  if (!row) return null;
  const accessRows = db
    .prepare("SELECT space_id FROM user_space_access WHERE user_id = ?")
    .all(String(row.id));
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: normalizeUserRole(row.role),
    allSpaces: Number(row.all_spaces) === 1,
    spaceIds: accessRows.map((r) => String(r.space_id)),
    createdAt: String(row.created_at),
  };
}

export async function dbFindUserById(id: string): Promise<PublicUser | null> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    const pool = getPgPool();
    const res = await pool.query<Record<string, unknown>>(
      "SELECT id, name, email, role, all_spaces, created_at FROM users WHERE id = $1",
      [id]
    );
    const row = res.rows[0];
    if (!row) return null;
    const accessRes = await pool.query<Record<string, unknown>>(
      "SELECT space_id FROM user_space_access WHERE user_id = $1",
      [id]
    );
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: normalizeUserRole(row.role),
      allSpaces: Number(row.all_spaces) === 1,
      spaceIds: accessRes.rows.map((r) => String(r.space_id)),
      createdAt: String(row.created_at),
    };
  }

  const db = await getSqlite();
  const row = db
    .prepare(
      "SELECT id, name, email, role, all_spaces, created_at FROM users WHERE id = ?"
    )
    .get(id);
  if (!row) return null;
  const accessRows = db
    .prepare("SELECT space_id FROM user_space_access WHERE user_id = ?")
    .all(id);
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: normalizeUserRole(row.role),
    allSpaces: Number(row.all_spaces) === 1,
    spaceIds: accessRows.map((r) => String(r.space_id)),
    createdAt: String(row.created_at),
  };
}

export async function dbCreateUser(input: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  allSpaces: boolean;
  spaceIds: string[];
}): Promise<PublicUser> {
  await ensureInitialized();
  const now = new Date().toISOString();
  const email = input.email.trim().toLowerCase();
  const uniqueSpaces = Array.from(new Set(input.spaceIds));

  if (getDatabaseDriver() === "postgres") {
    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, all_spaces, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.id,
          input.name.trim(),
          email,
          input.passwordHash,
          input.role,
          input.allSpaces ? 1 : 0,
          now,
        ]
      );
      for (const sid of uniqueSpaces) {
        await client.query(
          "INSERT INTO user_space_access (user_id, space_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [input.id, sid]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    const db = await getSqlite();
    db.exec("BEGIN");
    try {
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, role, all_spaces, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        input.id,
        input.name.trim(),
        email,
        input.passwordHash,
        input.role,
        input.allSpaces ? 1 : 0,
        now
      );
      const insertAccess = db.prepare(
        "INSERT OR IGNORE INTO user_space_access (user_id, space_id) VALUES (?, ?)"
      );
      for (const sid of uniqueSpaces) {
        insertAccess.run(input.id, sid);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  return {
    id: input.id,
    name: input.name.trim(),
    email,
    role: input.role,
    allSpaces: input.allSpaces,
    spaceIds: uniqueSpaces,
    createdAt: now,
  };
}

export async function dbUpdateUserAccess(
  id: string,
  input: { role?: UserRole; allSpaces?: boolean; spaceIds?: string[] }
): Promise<PublicUser | null> {
  await ensureInitialized();
  const existing = await dbFindUserById(id);
  if (!existing) return null;

  const nextRole = input.role ?? existing.role;
  const nextAllSpaces = input.allSpaces ?? existing.allSpaces;
  const nextSpaceIds = input.spaceIds
    ? Array.from(new Set(input.spaceIds))
    : existing.spaceIds;

  if (getDatabaseDriver() === "postgres") {
    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE users SET role = $1, all_spaces = $2 WHERE id = $3",
        [nextRole, nextAllSpaces ? 1 : 0, id]
      );
      await client.query(
        "DELETE FROM user_space_access WHERE user_id = $1",
        [id]
      );
      for (const sid of nextSpaceIds) {
        await client.query(
          "INSERT INTO user_space_access (user_id, space_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, sid]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    const db = await getSqlite();
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE users SET role = ?, all_spaces = ? WHERE id = ?").run(
        nextRole,
        nextAllSpaces ? 1 : 0,
        id
      );
      db.prepare("DELETE FROM user_space_access WHERE user_id = ?").run(id);
      const insertAccess = db.prepare(
        "INSERT OR IGNORE INTO user_space_access (user_id, space_id) VALUES (?, ?)"
      );
      for (const sid of nextSpaceIds) {
        insertAccess.run(id, sid);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  return {
    ...existing,
    role: nextRole,
    allSpaces: nextAllSpaces,
    spaceIds: nextSpaceIds,
  };
}

export async function dbDeleteUser(id: string): Promise<boolean> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM user_space_access WHERE user_id = $1", [
        id,
      ]);
      const res = await client.query("DELETE FROM users WHERE id = $1", [id]);
      await client.query("COMMIT");
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  const db = await getSqlite();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM user_space_access WHERE user_id = ?").run(id);
    const res = db.prepare("DELETE FROM users WHERE id = ?").run(id);
    db.exec("COMMIT");
    return Number(res.changes ?? 0) > 0;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

async function dbGetSetting(key: string): Promise<string | undefined> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    const res = await getPgPool().query<{ value: string }>(
      "SELECT value FROM workspace_settings WHERE key = $1",
      [key]
    );
    return res.rows[0]?.value;
  }
  const db = await getSqlite();
  const row = db
    .prepare("SELECT value FROM workspace_settings WHERE key = ?")
    .get(key);
  return row?.value === undefined ? undefined : String(row.value);
}

async function dbSetSetting(key: string, value: string): Promise<void> {
  await ensureInitialized();
  if (getDatabaseDriver() === "postgres") {
    await getPgPool().query(
      `INSERT INTO workspace_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
    return;
  }
  const db = await getSqlite();
  db.prepare(
    `INSERT INTO workspace_settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export async function dbGetAgentBotDraftOnly(): Promise<boolean> {
  const val = await dbGetSetting("agent_bot_draft_only");
  return val === undefined ? true : val !== "false";
}

export async function dbSetAgentBotDraftOnly(draftOnly: boolean): Promise<void> {
  await dbSetSetting("agent_bot_draft_only", draftOnly ? "true" : "false");
}

export interface BackupPolicy {
  enabled: boolean;
  schedule: "daily" | "weekly" | "manual";
  retentionCount: number;
  destinationNote: string;
}

const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  enabled: true,
  schedule: "daily",
  retentionCount: 14,
  destinationNote: "Lokal (brief_data/backups) + Offsite-Sync via scripts/backup.sh",
};

export async function dbGetBackupPolicy(): Promise<BackupPolicy> {
  const raw = await dbGetSetting("backup_policy");
  if (!raw) return DEFAULT_BACKUP_POLICY;
  try {
    const parsed = JSON.parse(raw) as Partial<BackupPolicy>;
    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_BACKUP_POLICY.enabled,
      schedule:
        parsed.schedule === "daily" ||
        parsed.schedule === "weekly" ||
        parsed.schedule === "manual"
          ? parsed.schedule
          : DEFAULT_BACKUP_POLICY.schedule,
      retentionCount:
        typeof parsed.retentionCount === "number" && parsed.retentionCount >= 1
          ? Math.min(365, Math.floor(parsed.retentionCount))
          : DEFAULT_BACKUP_POLICY.retentionCount,
      destinationNote:
        typeof parsed.destinationNote === "string"
          ? parsed.destinationNote
          : DEFAULT_BACKUP_POLICY.destinationNote,
    };
  } catch {
    return DEFAULT_BACKUP_POLICY;
  }
}

export async function dbSetBackupPolicy(
  policy: Partial<BackupPolicy>
): Promise<BackupPolicy> {
  const current = await dbGetBackupPolicy();
  const next: BackupPolicy = {
    enabled:
      typeof policy.enabled === "boolean" ? policy.enabled : current.enabled,
    schedule:
      policy.schedule === "daily" ||
      policy.schedule === "weekly" ||
      policy.schedule === "manual"
        ? policy.schedule
        : current.schedule,
    retentionCount:
      typeof policy.retentionCount === "number" && policy.retentionCount >= 1
        ? Math.min(365, Math.floor(policy.retentionCount))
        : current.retentionCount,
    destinationNote:
      typeof policy.destinationNote === "string"
        ? policy.destinationNote.trim()
        : current.destinationNote,
  };
  await dbSetSetting("backup_policy", JSON.stringify(next));
  return next;
}
