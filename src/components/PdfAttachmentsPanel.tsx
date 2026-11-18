"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Trash2,
  Upload,
} from "lucide-react";
import type { PdfAttachment } from "@/lib/uploads";

interface PdfAttachmentsPanelProps {
  docId: string;
  readOnly?: boolean;
  onInsertReference: (attachment: PdfAttachment) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PdfAttachmentsPanel({
  docId,
  readOnly = false,
  onInsertReference,
}: PdfAttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<PdfAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadAttachments = useCallback(async () => {
    if (!docId) return;
    try {
      const res = await fetch(`/api/uploads?docId=${encodeURIComponent(docId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { attachments?: PdfAttachment[] };
      setAttachments(data.attachments ?? []);
    } catch {
      // Ignore transient network errors
    }
  }, [docId]);

  useEffect(() => {
    setError(null);
    void loadAttachments();
  }, [loadAttachments]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("docId", docId);
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        attachment?: PdfAttachment;
        error?: string;
      };
      if (!res.ok || !data.attachment) {
        setError(data.error || "PDF-Upload fehlgeschlagen");
        return;
      }
      setAttachments((prev) => [data.attachment!, ...prev]);
    } catch {
      setError("Server nicht erreichbar");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(attachment: PdfAttachment) {
    setError(null);
    try {
      const res = await fetch(
        `/api/uploads/${encodeURIComponent(attachment.docId)}/${encodeURIComponent(attachment.storedName)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setError("PDF konnte nicht gelöscht werden");
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch {
      setError("Server nicht erreichbar");
    }
  }

  async function handleCopyMarkdown(attachment: PdfAttachment) {
    const md = `[${attachment.originalName}](${attachment.url})`;
    try {
      await navigator.clipboard.writeText(md);
      setCopiedId(attachment.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <section className="mt-8 border-t border-zinc-200/80 pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-teal-700" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            PDF-Anhänge ({attachments.length})
          </h2>
        </div>

        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Lädt hoch…" : "PDF hochladen"}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-zinc-400">
          Noch keine PDFs an diese Seite angehängt. Nach dem Upload kannst du
          das PDF direkt im Text verlinken.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/90 bg-zinc-50/70 px-3 py-2"
            >
              <div className="min-w-0">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-900 hover:text-teal-700 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                  <span className="truncate">{att.originalName}</span>
                </a>
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  {formatSize(att.sizeBytes)} · {att.uploadedBy} ·{" "}
                  {new Date(att.uploadedAt).toLocaleDateString("de-DE")}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onInsertReference(att)}
                    className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-800 hover:bg-teal-100"
                    title="Markdown-Link zum PDF in den Seitentext einfügen"
                  >
                    <Link2 className="h-3 w-3" />
                    Im Text verlinken
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyMarkdown(att)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100"
                  title="Markdown-Link kopieren"
                >
                  {copiedId === att.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" /> Kopiert
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Link
                    </>
                  )}
                </button>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100"
                  title="PDF öffnen"
                >
                  <ExternalLink className="h-3 w-3" />
                  Öffnen
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(att)}
                    className="rounded-md p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                    title="PDF löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
