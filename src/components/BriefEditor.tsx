"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Command,
  FilePlus2,
  Minimize2,
  PanelLeft,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  buildAgentContextMarkdown,
  buildSpaceContextMarkdown,
} from "@/lib/agent-context";
import { buildSearchIndex } from "@/lib/search-index";
import { SLASH_COMMANDS } from "@/lib/slash-commands";
import {
  DEFAULT_DOCUMENTS,
  DEFAULT_SPACES,
  findBacklinks,
  getDocumentAncestors,
  type BriefDocument,
  type Space,
} from "@/lib/workspace";
import { AgentMcpModal } from "./AgentMcpModal";
import { BacklinksPanel } from "./BacklinksPanel";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import {
  RichDocumentEditor,
  type RichDocumentEditorHandle,
} from "./RichDocumentEditor";
import { SearchModal } from "./SearchModal";
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
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [copiedAgentContext, setCopiedAgentContext] = useState(false);

  const richEditorRef = useRef<RichDocumentEditorHandle>(null);
  const hydratedRef = useRef(false);

  // Restore persisted workspace on mount and sync with server store (for agent Drafts)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_WORKSPACE_KEY);
      if (raw) {
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
      }
    } catch {
      // Ignore storage errors
    }

    const syncFromServer = async () => {
      try {
        const res = await fetch("/api/workspace");
        if (!res.ok) return;
        const serverData = (await res.json()) as {
          spaces?: Space[];
          documents?: BriefDocument[];
        };
        if (serverData.documents?.length) {
          setDocuments((prev) => {
            const localIds = new Set(prev.map((d) => d.id));
            const newDrafts = serverData.documents!.filter(
              (d) => d.status === "draft" && !localIds.has(d.id)
            );
            return newDrafts.length > 0 ? [...prev, ...newDrafts] : prev;
          });
        }
      } catch {
        // Ignore background sync errors
      } finally {
        hydratedRef.current = true;
      }
    };

    syncFromServer();
    window.addEventListener("focus", syncFromServer);
    return () => window.removeEventListener("focus", syncFromServer);
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

    if (!hydratedRef.current) return;
    const timer = setTimeout(() => {
      fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaces, documents }),
      }).catch(() => undefined);
    }, 600);
    return () => clearTimeout(timer);
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

  // Global keyboard shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+P, Cmd/Ctrl+Shift+F, Cmd/Ctrl+\)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(false);
        setPaletteOpen((prev) => !prev);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === "p" ||
          (e.shiftKey && e.key.toLowerCase() === "f"))
      ) {
        e.preventDefault();
        setPaletteOpen(false);
        setSearchOpen((prev) => !prev);
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
    } catch {
      // Clipboard may be unavailable
    }
  }, [content, title]);

  const handleCopyAgentContext = useCallback(async () => {
    if (!activeDoc) return;
    try {
      const payload = buildAgentContextMarkdown(activeDoc, documents, spaces, {
        sameSpaceOnly: true,
      });
      await navigator.clipboard.writeText(payload);
      setCopiedAgentContext(true);
      setTimeout(() => setCopiedAgentContext(false), 2000);
    } catch {
      // Clipboard may be unavailable
    }
  }, [activeDoc, documents, spaces]);

  const handleCopySpaceContext = useCallback(
    async (spaceId: string) => {
      const space = spaces.find((s) => s.id === spaceId);
      if (!space) return;
      try {
        const payload = buildSpaceContextMarkdown(space, documents);
        await navigator.clipboard.writeText(payload);
      } catch {
        // Clipboard may be unavailable
      }
    },
    [documents, spaces]
  );

  const searchIndex = useMemo(
    () => buildSearchIndex(documents, spaces),
    [documents, spaces]
  );

  const backlinks = useMemo(
    () => (activeDoc ? findBacklinks(activeDoc, documents, spaces) : []),
    [activeDoc, documents, spaces]
  );

  const paletteActions: PaletteAction[] = useMemo(() => {
    const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
    return [
      {
        id: "open-search",
        group: "Navigate" as const,
        label: "Instant Full-Text Search",
        description: "Search across all spaces and document contents (<50ms)",
        shortcut: "⌘P",
        onRun: () => setSearchOpen(true),
      },
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
        id: "doc-copy-agent-context",
        group: "Document",
        label: "Copy Page as Agent Context",
        description: `Export page + same-space linked docs (${activeSpace?.name ?? "Space"})`,
        onRun: handleCopyAgentContext,
      },
      ...(activeSpace
        ? [
            {
              id: "space-copy-agent-context",
              group: "Document" as const,
              label: `Copy Space as Agent Context (${activeSpace.name})`,
              description: `Export all documents in ${activeSpace.name} as Markdown`,
              onRun: () => handleCopySpaceContext(activeSpace.id),
            },
          ]
        : []),
      {
        id: "doc-copy",
        group: "Document",
        label: "Copy Markdown",
        description: "Copy document as Markdown to clipboard",
        onRun: handleCopyDocument,
      },
      {
        id: "agent-mcp-settings",
        group: "Document",
        label: "Agent API & MCP Settings",
        description: "Manage API tokens and MCP configuration for AI agents",
        onRun: () => setMcpModalOpen(true),
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
    activeSpace,
    documents,
    focusMode,
    handleCopyAgentContext,
    handleCopyDocument,
    handleCopySpaceContext,
    handleCreateDoc,
    sidebarOpen,
    spaces,
    title,
  ]);

  const handleApproveDraft = useCallback(
    (draft: BriefDocument) => {
      const now = new Date().toISOString();
      if (
        draft.proposalTargetId &&
        documents.some((d) => d.id === draft.proposalTargetId)
      ) {
        const targetId = draft.proposalTargetId;
        setDocuments((prev) =>
          prev
            .filter((d) => d.id !== draft.id)
            .map((d) =>
              d.id === targetId
                ? { ...d, content: draft.content, updatedAt: now }
                : d
            )
        );
        setActiveDocId(targetId);
        return;
      }

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === draft.id
            ? {
                ...d,
                status: "published",
                proposedBy: undefined,
                proposalTargetId: undefined,
                proposalSummary: undefined,
                updatedAt: now,
              }
            : d
        )
      );
    },
    [documents]
  );

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readingMinutes };
  }, [content]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 text-zinc-900">
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
                onClick={() => setSearchOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                title="Instant Search (Cmd+P)"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="rounded bg-white px-1 py-0.5 font-mono text-[10px] text-zinc-500 shadow-2xs">
                  ⌘P
                </kbd>
              </button>

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
                onClick={handleCopyAgentContext}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                title="Copy page + nested & [[linked]] docs as Agent Context"
              >
                {copiedAgentContext ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                    <span className="hidden lg:inline">Copied Context</span>
                  </>
                ) : (
                  <>
                    <Bot className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Copy Context</span>
                  </>
                )}
              </button>
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
            onCopySpaceContext={handleCopySpaceContext}
            onOpenAgentMcp={() => setMcpModalOpen(true)}
          />
        )}

        <main className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8">
          <article className="mx-auto flex w-full max-w-4xl flex-1 flex-col rounded-2xl border border-zinc-200 bg-white px-6 py-7 shadow-2xs sm:px-10 sm:py-9">
            {activeDoc?.status === "draft" && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    Agent Draft Proposal
                    {activeDoc.proposedBy ? ` · by ${activeDoc.proposedBy}` : ""}
                  </div>
                  {activeDoc.proposalSummary && (
                    <p className="mt-0.5 text-amber-800/90">
                      {activeDoc.proposalSummary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApproveDraft(activeDoc)}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-800"
                  >
                    Approve &amp; Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(activeDoc.id)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100/60"
                  >
                    Discard Draft
                  </button>
                </div>
              </div>
            )}
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
                  ⌘P
                </kbd>{" "}
                search
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

      <SearchModal
        open={searchOpen}
        index={searchIndex}
        spaces={spaces}
        onClose={() => setSearchOpen(false)}
        onSelectDoc={setActiveDocId}
      />

      <AgentMcpModal
        open={mcpModalOpen}
        onClose={() => setMcpModalOpen(false)}
      />
    </div>
  );
}
