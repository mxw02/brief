import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import {
  DEFAULT_DOCUMENTS,
  DEFAULT_SPACES,
  normalizeDocumentStatus,
  type BriefDocument,
  type Space,
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

function getDataDir(): string {
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
  proposal_summary TEXT
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
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

function mapDocRow(row: Record<string, unknown>): BriefDocument {
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
      pool.query<Record<string, unknown>>("SELECT id, name, slug FROM spaces"),
      pool.query<Record<string, unknown>>(
        "SELECT id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary FROM documents"
      ),
    ]);
    return {
      spaces: spacesRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        slug: String(r.slug),
      })),
      documents: docsRes.rows.map(mapDocRow),
    };
  }

  const db = await getSqlite();
  const spaces = db
    .prepare("SELECT id, name, slug FROM spaces")
    .all()
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
    }));
  const documents = db
    .prepare(
      "SELECT id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary FROM documents"
    )
    .all()
    .map(mapDocRow);

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
          `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
      `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of documents) {
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
      `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        doc.id,
        doc.spaceId,
        doc.parentId ?? null,
        doc.title,
        doc.content,
        doc.updatedAt,
        doc.status ?? "published",
        doc.proposedBy ?? null,
        doc.proposalTargetId ?? null,
        doc.proposalSummary ?? null,
      ]
    );
    return;
  }
  const db = await getSqlite();
  db.prepare(
    `INSERT INTO documents (id, space_id, parent_id, title, content, updated_at, status, proposed_by, proposal_target_id, proposal_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    doc.id,
    doc.spaceId,
    doc.parentId ?? null,
    doc.title,
    doc.content,
    doc.updatedAt,
    doc.status ?? "published",
    doc.proposedBy ?? null,
    doc.proposalTargetId ?? null,
    doc.proposalSummary ?? null
  );
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
