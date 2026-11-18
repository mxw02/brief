import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  dbGetAgentBotDraftOnly,
  dbGetBackupPolicy,
  dbReadWorkspace,
  dbSetAgentBotDraftOnly,
  dbSetBackupPolicy,
  dbWriteWorkspace,
  getDataDir,
  getDatabaseDriver,
  type BackupPolicy,
} from "./db";
import type { BriefDocument, Space } from "./workspace";

const BACKUP_FILE_RE = /^brief-backup-[0-9T_-]+\.json\.gz$/;

export interface BackupSnapshot {
  version: 1;
  createdAt: string;
  createdBy: string;
  driver: string;
  spaces: Space[];
  documents: BriefDocument[];
  settings: {
    agentBotDraftOnly: boolean;
    backupPolicy: BackupPolicy;
  };
}

export interface BackupSummary {
  id: string;
  createdAt: string;
  createdBy: string;
  driver: string;
  sizeBytes: number;
  spaceCount: number;
  documentCount: number;
  sha256: string;
}

function getBackupsDir(): string {
  return path.join(getDataDir(), "backups");
}

function assertValidBackupId(id: string): string {
  if (!BACKUP_FILE_RE.test(id)) {
    throw new Error("Invalid backup ID");
  }
  return path.join(getBackupsDir(), id);
}

function parseSnapshotBuffer(buf: Buffer): BackupSnapshot {
  let rawJson: string;
  try {
    // Support both .json.gz and plain .json uploads
    rawJson = buf[0] === 0x1f && buf[1] === 0x8b
      ? gunzipSync(buf).toString("utf8")
      : buf.toString("utf8");
  } catch {
    throw new Error("Backup-Datei konnte nicht entpackt werden");
  }

  let parsed: Partial<BackupSnapshot>;
  try {
    parsed = JSON.parse(rawJson) as Partial<BackupSnapshot>;
  } catch {
    throw new Error("Ungültiges JSON in der Backup-Datei");
  }

  if (!Array.isArray(parsed.spaces) || !Array.isArray(parsed.documents)) {
    throw new Error("Backup-Datei enthält keine gültigen Spaces/Dokumente");
  }

  return {
    version: 1,
    createdAt:
      typeof parsed.createdAt === "string"
        ? parsed.createdAt
        : new Date().toISOString(),
    createdBy:
      typeof parsed.createdBy === "string" ? parsed.createdBy : "Unknown",
    driver: typeof parsed.driver === "string" ? parsed.driver : "unknown",
    spaces: parsed.spaces,
    documents: parsed.documents,
    settings: {
      agentBotDraftOnly:
        typeof parsed.settings?.agentBotDraftOnly === "boolean"
          ? parsed.settings.agentBotDraftOnly
          : true,
      backupPolicy: parsed.settings?.backupPolicy ?? {
        enabled: true,
        schedule: "daily",
        retentionCount: 14,
        destinationNote: "",
      },
    },
  };
}

function toSummary(
  id: string,
  buf: Buffer,
  snapshot: BackupSnapshot
): BackupSummary {
  return {
    id,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    driver: snapshot.driver,
    sizeBytes: buf.length,
    spaceCount: snapshot.spaces.length,
    documentCount: snapshot.documents.length,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
  };
}

/** Lists all stored workspace backup snapshots newest first. */
export async function listBackups(): Promise<BackupSummary[]> {
  const dir = getBackupsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const files = entries
    .filter((name) => BACKUP_FILE_RE.test(name))
    .sort((a, b) => b.localeCompare(a));

  const summaries: BackupSummary[] = [];
  for (const file of files) {
    try {
      const buf = await fs.readFile(path.join(dir, file));
      const snapshot = parseSnapshotBuffer(buf);
      summaries.push(toSummary(file, buf, snapshot));
    } catch {
      // Skip corrupted files when listing
    }
  }
  return summaries;
}

/** Creates a gzip-compressed backup snapshot and enforces retentionCount. */
export async function createBackupSnapshot(
  createdBy: string
): Promise<BackupSummary> {
  const dir = getBackupsDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });

  const [{ spaces, documents }, agentBotDraftOnly, backupPolicy] =
    await Promise.all([
      dbReadWorkspace(),
      dbGetAgentBotDraftOnly(),
      dbGetBackupPolicy(),
    ]);

  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const id = `brief-backup-${stamp}.json.gz`;

  const snapshot: BackupSnapshot = {
    version: 1,
    createdAt: now.toISOString(),
    createdBy: createdBy.trim() || "Admin",
    driver: getDatabaseDriver(),
    spaces,
    documents,
    settings: {
      agentBotDraftOnly,
      backupPolicy,
    },
  };

  const compressed = gzipSync(Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"));
  await fs.writeFile(path.join(dir, id), compressed, { mode: 0o600 });

  // Enforce retention count
  const entries = (await fs.readdir(dir))
    .filter((name) => BACKUP_FILE_RE.test(name))
    .sort((a, b) => b.localeCompare(a));
  const excess = entries.slice(backupPolicy.retentionCount);
  await Promise.all(
    excess.map((oldFile) => fs.unlink(path.join(dir, oldFile)).catch(() => undefined))
  );

  return toSummary(id, compressed, snapshot);
}

/** Reads the raw gzipped backup buffer for download. */
export async function readBackupBuffer(id: string): Promise<Buffer> {
  const filePath = assertValidBackupId(id);
  return fs.readFile(filePath);
}

/** Restores workspace data and settings from a backup buffer. */
export async function restoreBackupFromBuffer(
  buf: Buffer
): Promise<{ spaceCount: number; documentCount: number }> {
  const snapshot = parseSnapshotBuffer(buf);
  await dbWriteWorkspace(snapshot.spaces, snapshot.documents);
  await dbSetAgentBotDraftOnly(snapshot.settings.agentBotDraftOnly);
  if (snapshot.settings.backupPolicy) {
    await dbSetBackupPolicy(snapshot.settings.backupPolicy);
  }
  return {
    spaceCount: snapshot.spaces.length,
    documentCount: snapshot.documents.length,
  };
}

/** Restores workspace data from a stored backup ID. */
export async function restoreBackupById(
  id: string
): Promise<{ spaceCount: number; documentCount: number }> {
  const buf = await readBackupBuffer(id);
  return restoreBackupFromBuffer(buf);
}

/** Deletes a stored backup file by ID. */
export async function deleteBackupById(id: string): Promise<void> {
  const filePath = assertValidBackupId(id);
  await fs.unlink(filePath);
}
