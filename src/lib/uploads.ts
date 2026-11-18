import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SAFE_DOC_ID_RE = /^[a-zA-Z0-9_-]{1,120}$/;
const SAFE_FILE_RE = /^[a-zA-Z0-9._-]{1,180}\.pdf$/i;
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

export interface PdfAttachment {
  id: string;
  docId: string;
  originalName: string;
  storedName: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
}

export function getUploadsDir(): string {
  return (
    process.env.BRIEF_UPLOADS_DIR?.trim() || path.join(process.cwd(), "uploads")
  );
}

function getPageUploadsDir(docId: string): string {
  if (!SAFE_DOC_ID_RE.test(docId)) {
    throw new Error("Ungültige Dokument-ID");
  }
  return path.join(getUploadsDir(), docId);
}

function getMetadataPath(docDir: string): string {
  return path.join(docDir, "attachments.json");
}

async function readMetadata(docDir: string): Promise<PdfAttachment[]> {
  try {
    const raw = await fs.readFile(getMetadataPath(docDir), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PdfAttachment[]) : [];
  } catch {
    return [];
  }
}

async function writeMetadata(
  docDir: string,
  items: PdfAttachment[]
): Promise<void> {
  await fs.writeFile(
    getMetadataPath(docDir),
    JSON.stringify(items, null, 2),
    "utf8"
  );
}

/** Lists all PDF attachments stored for a given page. */
export async function listPageAttachments(
  docId: string
): Promise<PdfAttachment[]> {
  const docDir = getPageUploadsDir(docId);
  return readMetadata(docDir);
}

/** Validates and stores a PDF file for a specific page. */
export async function savePdfAttachment(
  docId: string,
  file: File,
  uploadedBy: string
): Promise<PdfAttachment> {
  const docDir = getPageUploadsDir(docId);
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Es werden nur PDF-Dateien (.pdf) unterstützt.");
  }
  if (file.size <= 0) {
    throw new Error("Die hochgeladene Datei ist leer.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF darf maximal 25 MB groß sein.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Verify %PDF- magic header
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Ungültiges PDF-Format (fehlender %PDF-Header).");
  }

  const baseName = path
    .basename(file.name, path.extname(file.name))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  const id = crypto.randomUUID().slice(0, 8);
  const storedName = `${id}-${baseName || "document"}.pdf`;

  await fs.mkdir(docDir, { recursive: true });
  await fs.writeFile(path.join(docDir, storedName), buffer);

  const attachment: PdfAttachment = {
    id,
    docId,
    originalName: path.basename(file.name) || storedName,
    storedName,
    sizeBytes: buffer.length,
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy.trim() || "User",
    url: `/api/uploads/${encodeURIComponent(docId)}/${encodeURIComponent(storedName)}`,
  };

  const existing = await readMetadata(docDir);
  existing.unshift(attachment);
  await writeMetadata(docDir, existing);

  return attachment;
}

/** Reads a stored PDF file for inline browser viewing. */
export async function readPdfAttachment(
  docId: string,
  storedName: string
): Promise<{ buffer: Buffer; originalName: string }> {
  const docDir = getPageUploadsDir(docId);
  if (!SAFE_FILE_RE.test(storedName)) {
    throw new Error("Ungültiger Dateiname");
  }
  const filePath = path.join(docDir, storedName);
  const [buffer, items] = await Promise.all([
    fs.readFile(filePath),
    readMetadata(docDir),
  ]);
  const meta = items.find((i) => i.storedName === storedName);
  return {
    buffer,
    originalName: meta?.originalName || storedName,
  };
}

/** Deletes a stored PDF file and removes it from page metadata. */
export async function deletePdfAttachment(
  docId: string,
  storedName: string
): Promise<void> {
  const docDir = getPageUploadsDir(docId);
  if (!SAFE_FILE_RE.test(storedName)) {
    throw new Error("Ungültiger Dateiname");
  }
  await fs.unlink(path.join(docDir, storedName)).catch(() => undefined);
  const existing = await readMetadata(docDir);
  await writeMetadata(
    docDir,
    existing.filter((item) => item.storedName !== storedName)
  );
}
