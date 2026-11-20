"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Database,
  Download,
  HardDrive,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { BackupPolicy } from "@/lib/db";
import type { BackupSummary } from "@/lib/backups";
import type { PublicUser } from "@/lib/workspace";

interface SettingsPageClientProps {
  currentUser: PublicUser | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsPageClient({ currentUser }: SettingsPageClientProps) {
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [policy, setPolicy] = useState<BackupPolicy>({
    enabled: true,
    schedule: "daily",
    retentionCount: 14,
    destinationNote: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backups");
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage({
          type: "error",
          text: err.error || "Backups konnten nicht geladen werden",
        });
        return;
      }
      const data = (await res.json()) as {
        backups: BackupSummary[];
        policy: BackupPolicy;
      };
      setBackups(data.backups || []);
      if (data.policy) setPolicy(data.policy);
    } catch {
      setMessage({ type: "error", text: "Server nicht erreichbar" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      void loadBackups();
    } else {
      setLoading(false);
    }
  }, [currentUser?.role, loadBackups]);

  async function handleCreateBackup() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backups", { method: "POST" });
      const data = (await res.json()) as {
        backup?: BackupSummary;
        error?: string;
      };
      if (!res.ok || !data.backup) {
        setMessage({
          type: "error",
          text: data.error || "Backup fehlgeschlagen",
        });
        return;
      }
      setMessage({
        type: "success",
        text: `Backup "${data.backup.id}" erstellt (${data.backup.spaceCount} Spaces, ${data.backup.documentCount} Dokumente).`,
      });
      await loadBackups();
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    setSavingPolicy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = (await res.json()) as {
        policy?: BackupPolicy;
        error?: string;
      };
      if (!res.ok || !data.policy) {
        setMessage({
          type: "error",
          text: data.error || "Strategie konnte nicht gespeichert werden",
        });
        return;
      }
      setPolicy(data.policy);
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 1800);
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleRestoreBackup(backup: BackupSummary) {
    if (
      !window.confirm(
        `Backup "${backup.id}" (${backup.spaceCount} Spaces, ${backup.documentCount} Dokumente) wirklich wiederherstellen? Aktuelle Spaces und Dokumente werden dadurch ersetzt.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(backup.id)}`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        spaceCount?: number;
        documentCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Wiederherstellung fehlgeschlagen",
        });
        return;
      }
      setMessage({
        type: "success",
        text: `Backup wiederhergestellt (${data.spaceCount} Spaces, ${data.documentCount} Dokumente).`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteBackup(backup: BackupSummary) {
    if (!window.confirm(`Backup "${backup.id}" wirklich löschen?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(backup.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setMessage({
          type: "error",
          text: "Backup konnte nicht gelöscht werden",
        });
        return;
      }
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      !window.confirm(
        `Backup-Datei "${file.name}" hochladen und wiederherstellen? Aktuelle Spaces und Dokumente werden dadurch ersetzt.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        spaceCount?: number;
        documentCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Upload-Restore fehlgeschlagen",
        });
        return;
      }
      setMessage({
        type: "success",
        text: `Hochgeladenes Backup wiederhergestellt (${data.spaceCount} Spaces, ${data.documentCount} Dokumente).`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zu Brief
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Settings className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-zinc-900">
                  Einstellungen &amp; Backups
                </h1>
              </div>
            </div>
          </div>

          {currentUser && (
            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
              {currentUser.name} ({currentUser.role})
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {!currentUser || currentUser.role !== "admin" ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-2xs">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
            <h2 className="text-base font-semibold text-zinc-900">
              Admin-Berechtigung erforderlich
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Bitte melde dich als Administrator an, um Backups und Einstellungen
              zu verwalten.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
            >
              Zur Anmeldung
            </Link>
          </div>
        ) : (
          <>
            {message && (
              <div
                className={`rounded-xl border px-4 py-3 text-xs font-medium ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Backup Strategy Settings */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Backup-Strategie
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Lege fest, wie oft Snapshots erstellt, wie viele Versionen
                      aufbewahrt und wohin sie gesichert werden.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSavePolicy} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-xs font-medium text-zinc-800">
                    <span>Backups aktiv</span>
                    <input
                      type="checkbox"
                      checked={policy.enabled}
                      onChange={(e) =>
                        setPolicy((p) => ({ ...p, enabled: e.target.checked }))
                      }
                      className="h-4 w-4 accent-teal-700"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">Zeitplan</span>
                    <select
                      value={policy.schedule}
                      onChange={(e) =>
                        setPolicy((p) => ({
                          ...p,
                          schedule: e.target.value as BackupPolicy["schedule"],
                        }))
                      }
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-teal-700 focus:outline-none"
                    >
                      <option value="daily">Täglich (03:00 Uhr)</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="manual">Nur manuell</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-zinc-600">
                      Aufbewahrung (Anzahl Backups)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={policy.retentionCount}
                      onChange={(e) =>
                        setPolicy((p) => ({
                          ...p,
                          retentionCount: Math.max(
                            1,
                            Number(e.target.value) || 14
                          ),
                        }))
                      }
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-teal-700 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-zinc-600">
                    Ziel / Offsite-Hinweis (3-2-1-Regel)
                  </span>
                  <input
                    type="text"
                    value={policy.destinationNote}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        destinationNote: e.target.value,
                      }))
                    }
                    placeholder="z. B. Lokal (brief_data/backups) + NAS rsync + Offsite S3"
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-teal-700 focus:outline-none"
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPolicy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {policySaved ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Gespeichert
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Strategie speichern
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Backup Snapshots Management */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Workspace-Backups ({backups.length})
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Snapshots enthalten alle Spaces, Dokumente, Entwürfe,
                      Kommentare und Einstellungen als komprimierte{" "}
                      <code>.json.gz</code>-Datei.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".gz,.json,application/gzip,application/json"
                    onChange={handleUploadRestore}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Backup hochladen &amp; wiederherstellen
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreateBackup}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Backup jetzt erstellen
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Backups werden geladen…
                </div>
              ) : backups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-10 text-center">
                  <p className="text-xs text-zinc-500">
                    Noch keine Backups vorhanden. Erstelle jetzt deinen ersten
                    Snapshot.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {backups.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-zinc-900">
                            {b.id}
                          </span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                            {formatBytes(b.sizeBytes)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                          <span>
                            {new Date(b.createdAt).toLocaleString("de-DE")}
                          </span>
                          <span>Erstellt von {b.createdBy}</span>
                          <span>
                            {b.spaceCount} Spaces · {b.documentCount} Dokumente
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            SHA256: {b.sha256.slice(0, 12)}…
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/api/backups/${encodeURIComponent(b.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          title="Backup herunterladen"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRestoreBackup(b)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          title="Dieses Backup wiederherstellen"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteBackup(b)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          title="Backup löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[11px] text-zinc-600">
                <strong>Server-Vollbackup (inkl. PostgreSQL, Uploads &amp; .env):</strong>{" "}
                Für automatisierte Cronjobs auf dem Server stehen zusätzlich{" "}
                <code className="font-mono">./scripts/backup.sh</code> und{" "}
                <code className="font-mono">./scripts/restore.sh</code> (siehe{" "}
                <code className="font-mono">docs/BACKUP_STRATEGY.md</code>) zur Verfügung.
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
