"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Code2,
  Command,
  Copy,
  FilePlus2,
  Maximize2,
  Minimize2,
  PanelLeft,
  RotateCcw,
} from "lucide-react";
import { SLASH_COMMANDS } from "@/lib/slash-commands";
import {
  DEFAULT_DOCUMENTS,
  DEFAULT_SPACES,
  findBacklinks,
  getDocumentAncestors,
  type BriefDocument,
  type Space,
} from "@/lib/workspace";
import { BacklinksPanel } from "./BacklinksPanel";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import {
  RichDocumentEditor,
  type RichDocumentEditorHandle,
} from "./RichDocumentEditor";
import { SpaceSidebar } from "./SpaceSidebar";

const STORAGE_WORKSPACE_KEY = "brief:workspace:v2";

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

export function BriefEditor() {
  const [spaces, setSpaces] = useState<Space[]>(DEFAULT_SPACES);
  const [documents, setDocuments] =
    useState<BriefDocument[]>(DEFAULT_DOCUMENTS);
  const [activeDocId, setActiveDocId] = useState<string>(
    DEFAULT_DOCUMENTS[0].id
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMarkdownSource, setShowMarkdownSource] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const richEditorRef = useRef<RichDocumentEditorHandle>(null);

  // Restore persisted workspace on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_WORKSPACE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        spaces?: Space[];
        documents?: BriefDocument[];
        activeDocId?: string;
      };
      if (parsed.spaces?.length && parsed.documents?.length) {
        setSpaces(parsed.spaces);
        setDocuments(
          parsed.documents.map((d) => ({ ...d, parentId: d.parentId ?? null }))
        );
        if (
          parsed.activeDocId &&
          parsed.documents.some((d) => d.id === parsed.activeDocId)
        ) {
          setActiveDocId(parsed.activeDocId);
        } else {
          setActiveDocId(parsed.documents[0].id);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_WORKSPACE_KEY,
        JSON.stringify({ spaces, documents, activeDocId })
      );
    } catch {
      // Ignore storage errors
    }
  }, [spaces, documents, activeDocId]);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? documents[0],
    [documents, activeDocId]
  );

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeDoc?.spaceId),
    [spaces, activeDoc]
  );

  const ancestors = useMemo(
    () => (activeDoc ? getDocumentAncestors(activeDoc.id, documents) : []),
    [activeDoc, documents]
  );

  const title = activeDoc?.title ?? "";
  const content = activeDoc?.content ?? "";

  const updateActiveDoc = useCallback(
    (patch: Partial<Pick<BriefDocument, "title" | "content">>) => {
      const now = new Date().toISOString();
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === activeDoc?.id ? { ...doc, ...patch, updatedAt: now } : doc
        )
      );
    },
    [activeDoc?.id]
  );

  // Global keyboard shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+\)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  const handleCreateDoc = useCallback(
    (spaceId: string, parentId: string | null = null, customTitle?: string) => {
      const docTitle = customTitle?.trim() || "Untitled Page";
      const newDoc: BriefDocument = {
        id: makeId("doc"),
        spaceId,
        parentId,
        title: docTitle,
        content: `## Overview\n\nStart writing **${docTitle}**...\n`,
        updatedAt: new Date().toISOString(),
      };
      setDocuments((prev) => [...prev, newDoc]);
      setActiveDocId(newDoc.id);
      setShowMarkdownSource(false);
    },
    []
  );

  const handleDeleteDoc = useCallback(
    (docId: string) => {
      setDocuments((prev) => {
        if (prev.length <= 1) return prev;
        const target = prev.find((d) => d.id === docId);
        // Re-parent any child pages cleanly so no nested pages are orphaned
        const next = prev
          .filter((d) => d.id !== docId)
          .map((d) =>
            d.parentId === docId
              ? { ...d, parentId: target?.parentId ?? null }
              : d
          );
        if (docId === activeDocId && next[0]) {
          setActiveDocId(next[0].id);
        }
        return next;
      });
    },
    [activeDocId]
  );

  const handleCreateSpace = useCallback((name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const newSpace: Space = {
      id: makeId("space"),
      name,
      slug: slug || "space",
    };
    setSpaces((prev) => [...prev, newSpace]);
  }, []);

  const handleOpenOrCreateWikiLink = useCallback(
    (targetTitle: string) => {
      const normalized = targetTitle.trim().toLowerCase();
      const existing = documents.find(
        (d) => d.title.trim().toLowerCase() === normalized
      );
      if (existing) {
        setActiveDocId(existing.id);
        return;
      }
      if (activeDoc) {
        handleCreateDoc(activeDoc.spaceId, activeDoc.id, targetTitle.trim());
      }
    },
    [activeDoc, documents, handleCreateDoc]
  );

  const handleCreateAndLinkDoc = useCallback(
    (docTitle: string) => {
      if (!activeDoc) return;
      const newDoc: BriefDocument = {
        id: makeId("doc"),
        spaceId: activeDoc.spaceId,
        parentId: activeDoc.id,
        title: docTitle,
        content: `## Overview\n\n`,
        updatedAt: new Date().toISOString(),
      };
      setDocuments((prev) => [...prev, newDoc]);
    },
    [activeDoc]
  );

  const handleCopyDocument = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`# ${title}\n\n${content}`);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 1800);
    } catch {
      // Clipboard may be unavailable
    }
  }, [content, title]);

  const backlinks = useMemo(
    () => (activeDoc ? findBacklinks(activeDoc, documents, spaces) : []),
    [activeDoc, documents, spaces]
  );

  const paletteActions: PaletteAction[] = useMemo(() => {
    const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
    return [
      ...documents.map((doc) => ({
        id: `nav-${doc.id}`,
        group: "Navigate" as const,
        label: doc.title || "Untitled",
        description: `Open in ${spaceMap.get(doc.spaceId) ?? "Space"}`,
        onRun: () => setActiveDocId(doc.id),
      })),
      {
        id: "toggle-sidebar",
        group: "View",
        label: sidebarOpen ? "Hide Spaces Sidebar" : "Show Spaces Sidebar",
        description: "Toggle nested page tree",
        onRun: () => setSidebarOpen((prev) => !prev),
      },
      {
        id: "toggle-source",
        group: "View",
        label: showMarkdownSource
          ? "Back to Rich Document"
          : "View Raw Markdown",
        description: "Inspect or copy underlying Markdown",
        onRun: () => setShowMarkdownSource((prev) => !prev),
      },
      {
        id: "toggle-focus",
        group: "View",
        label: focusMode ? "Exit Focus Mode" : "Enter Focus Mode",
        description: "Hide chrome for distraction-free writing",
        shortcut: "⌘\\",
        onRun: () => setFocusMode((prev) => !prev),
      },
      ...SLASH_COMMANDS.map((cmd) => ({
        id: `insert-${cmd.id}`,
        group: (cmd.category === "template" ? "Template" : "Insert") as
          | "Template"
          | "Insert",
        label:
          cmd.category === "template"
            ? `Template: ${cmd.label}`
            : `Insert ${cmd.label}`,
        description: cmd.description,
        shortcut: cmd.shortcut,
        onRun: () => {
          setShowMarkdownSource(false);
          richEditorRef.current?.insertMarkdownSnippet(cmd.snippet);
        },
      })),
      {
        id: "doc-new-child",
        group: "Document",
        label: "New Nested Child Page",
        description: `Create a sub-page under "${title || "Untitled"}"`,
        onRun: () => {
          if (activeDoc) handleCreateDoc(activeDoc.spaceId, activeDoc.id);
        },
      },
      {
        id: "doc-new-root",
        group: "Document",
        label: "New Top-Level Page",
        description: `Create a page in ${activeSpace?.name ?? "Space"}`,
        onRun: () => {
          if (activeDoc) handleCreateDoc(activeDoc.spaceId, null);
        },
      },
      {
        id: "doc-copy",
        group: "Document",
        label: "Copy Markdown",
        description: "Copy document as Markdown to clipboard",
        onRun: handleCopyDocument,
      },
      {
        id: "doc-reset",
        group: "Document",
        label: "Reset Demo Workspace",
        description: "Restore default Spaces and nested docs",
        onRun: () => {
          setSpaces(DEFAULT_SPACES);
          setDocuments(DEFAULT_DOCUMENTS);
          setActiveDocId(DEFAULT_DOCUMENTS[0].id);
        },
      },
    ];
  }, [
    activeDoc,
    activeSpace?.name,
    documents,
    focusMode,
    handleCopyDocument,
    handleCreateDoc,
    showMarkdownSource,
    sidebarOpen,
    spaces,
    title,
  ]);

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readingMinutes };
  }, [content]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      {!focusMode && (
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className={`rounded-lg border p-1.5 transition-colors ${
                  sidebarOpen
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
                }`}
                title="Toggle Spaces & Page Tree"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f766e] text-sm font-bold text-white shadow-xs">
                B
              </span>

              <nav
                aria-label="Breadcrumb"
                className="flex min-w-0 items-center gap-1.5 text-xs"
              >
                {activeSpace && (
                  <span className="hidden rounded-md border border-zinc-200 bg-zinc-100/70 px-1.5 py-0.5 font-medium text-zinc-600 sm:inline">
                    {activeSpace.name}
                  </span>
                )}
                {ancestors.map((ancestor) => (
                  <span
                    key={ancestor.id}
                    className="hidden items-center gap-1.5 md:inline-flex"
                  >
                    <span className="text-zinc-300">/</span>
                    <button
                      type="button"
                      onClick={() => setActiveDocId(ancestor.id)}
                      className="max-w-[140px] truncate text-zinc-500 hover:text-teal-700"
                    >
                      {ancestor.title}
                    </button>
                  </span>
                ))}
                <span className="text-zinc-300">/</span>
                <span className="truncate font-semibold text-zinc-800">
                  {title || "Untitled"}
                </span>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeDoc) handleCreateDoc(activeDoc.spaceId, activeDoc.id);
                }}
                className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 sm:inline-flex"
                title="Create nested child page"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Child Page</span>
              </button>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                title="Command Palette (Cmd+K)"
              >
                <Command className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Commands</span>
                <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px] text-zinc-500">
                  ⌘K
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setShowMarkdownSource((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  showMarkdownSource
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100/70"
                }`}
                title="Inspect raw Markdown"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">MD</span>
              </button>

              <button
                type="button"
                onClick={handleCopyDocument}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100/70"
                title="Copy Markdown"
              >
                {copiedDoc ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setFocusMode(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-800"
                title="Focus Mode (Cmd+\)"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Focus</span>
              </button>

              <Link
                href="/api/health"
                className="hidden items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 xl:inline-flex"
                title="Healthcheck"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
              </Link>
            </div>
          </div>
        </header>
      )}

      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="fixed right-5 top-4 z-40 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur transition-colors hover:text-zinc-900"
        >
          <Minimize2 className="h-3.5 w-3.5 text-teal-700" />
          Exit Focus (⌘\)
        </button>
      )}

      <div className="flex flex-1 overflow-hidden">
        {!focusMode && sidebarOpen && (
          <SpaceSidebar
            spaces={spaces}
            documents={documents}
            activeDocId={activeDoc?.id ?? ""}
            onSelectDoc={setActiveDocId}
            onCreateDoc={(spaceId, parentId) =>
              handleCreateDoc(spaceId, parentId ?? null)
            }
            onDeleteDoc={handleDeleteDoc}
            onCreateSpace={handleCreateSpace}
          />
        )}

        <main className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8">
          <article className="mx-auto flex w-full max-w-4xl flex-1 flex-col rounded-2xl border border-zinc-200 bg-white px-6 py-7 shadow-2xs sm:px-10 sm:py-9">
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
              <input
                type="text"
                value={title}
                onChange={(e) => updateActiveDoc({ title: e.target.value })}
                placeholder="Page Title"
                aria-label="Page title"
                className="w-full bg-transparent text-3xl font-bold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none sm:text-4xl"
              />
              <button
                type="button"
                onClick={() => {
                  setSpaces(DEFAULT_SPACES);
                  setDocuments(DEFAULT_DOCUMENTS);
                  setActiveDocId(DEFAULT_DOCUMENTS[0].id);
                }}
                className="mt-1 shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                title="Reset demo workspace"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {showMarkdownSource ? (
              <pre className="flex-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-[13px] leading-relaxed text-zinc-700">
                {`# ${title}\n\n${content}`}
              </pre>
            ) : (
              <RichDocumentEditor
                ref={richEditorRef}
                docId={activeDoc?.id ?? "default"}
                content={content}
                documents={documents}
                spaces={spaces}
                onChangeMarkdown={(md) => updateActiveDoc({ content: md })}
                onOpenOrCreateWikiLink={handleOpenOrCreateWikiLink}
                onCreateAndLinkDoc={handleCreateAndLinkDoc}
              />
            )}

            <BacklinksPanel
              backlinks={backlinks}
              onNavigate={setActiveDocId}
            />
          </article>
        </main>
      </div>

      {!focusMode && (
        <footer className="border-t border-zinc-200/80 bg-white px-4 py-2 text-xs text-zinc-500 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <span>{stats.words} words</span>
              <span>{stats.chars} chars</span>
              <span>~{stats.readingMinutes} min read</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
              <span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-600">
                  /
                </kbd>{" "}
                blocks &amp; templates
              </span>
              <span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-600">
                  [[
                </kbd>{" "}
                link doc
              </span>
              <span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-600">
                  ⌘K
                </kbd>{" "}
                palette
              </span>
              <span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-600">
                  ⌘\
                </kbd>{" "}
                focus
              </span>
            </div>
          </div>
        </footer>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />
    </div>
  );
}
