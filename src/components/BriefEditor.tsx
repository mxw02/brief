"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Columns2,
  Command,
  Copy,
  Eye,
  FilePlus2,
  Maximize2,
  Minimize2,
  PanelLeft,
  PenLine,
  RotateCcw,
} from "lucide-react";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/slash-commands";
import {
  DEFAULT_DOCUMENTS,
  DEFAULT_SPACES,
  findBacklinks,
  type BriefDocument,
  type Space,
} from "@/lib/workspace";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { MarkdownPreview } from "./MarkdownPreview";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { SpaceSidebar } from "./SpaceSidebar";
import { WikiLinkMenu } from "./WikiLinkMenu";

type ViewMode = "write" | "split" | "preview";

const STORAGE_WORKSPACE_KEY = "brief:workspace:v1";

interface TriggerState {
  open: boolean;
  query: string;
  triggerIndex: number;
  position: { top: number; left: number };
}

const CLOSED_TRIGGER: TriggerState = {
  open: false,
  query: "",
  triggerIndex: -1,
  position: { top: 48, left: 24 },
};

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
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const [slashIndex, setSlashIndex] = useState(0);
  const [slashState, setSlashState] = useState<TriggerState>(CLOSED_TRIGGER);

  const [wikiIndex, setWikiIndex] = useState(0);
  const [wikiState, setWikiState] = useState<TriggerState>(CLOSED_TRIGGER);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        setDocuments(parsed.documents);
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
        setSlashState(CLOSED_TRIGGER);
        setWikiState(CLOSED_TRIGGER);
        setPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  const filteredSlashCommands = useMemo(() => {
    const q = slashState.query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.shortcut.toLowerCase().includes(`/${q}`) ||
        cmd.keywords.some((kw) => kw.includes(q))
    );
  }, [slashState.query]);

  const filteredWikiDocs = useMemo(() => {
    const q = wikiState.query.trim().toLowerCase();
    const candidates = documents.filter((d) => d.id !== activeDoc?.id);
    if (!q) return candidates;
    return candidates.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, activeDoc?.id, wikiState.query]);

  const wikiTotalOptions = useMemo(() => {
    const trimmed = wikiState.query.trim();
    const exactExists = filteredWikiDocs.some(
      (d) => d.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    return filteredWikiDocs.length + (trimmed && !exactExists ? 1 : 0);
  }, [filteredWikiDocs, wikiState.query]);

  useEffect(() => {
    if (slashIndex >= filteredSlashCommands.length) setSlashIndex(0);
  }, [slashIndex, filteredSlashCommands.length]);

  useEffect(() => {
    if (wikiIndex >= wikiTotalOptions) setWikiIndex(0);
  }, [wikiIndex, wikiTotalOptions]);

  const computeMenuPosition = useCallback(
    (textarea: HTMLTextAreaElement, cursorPos: number) => {
      const textBefore = textarea.value.slice(0, cursorPos);
      const lines = textBefore.split("\n");
      const currentLineIndex = lines.length - 1;
      const lineHeight = 24;
      const approxTop = Math.min(
        Math.max(
          36,
          (currentLineIndex + 1) * lineHeight - textarea.scrollTop + 12
        ),
        Math.max(120, textarea.clientHeight - 160)
      );
      const approxLeft = Math.min(
        24 + (lines[currentLineIndex]?.length ?? 0) * 7,
        Math.max(24, textarea.clientWidth - 320)
      );
      return { top: approxTop, left: approxLeft };
    },
    []
  );

  const detectEditorTriggers = useCallback(
    (value: string, cursorPos: number, textarea: HTMLTextAreaElement) => {
      const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
      const linePrefix = value.slice(lineStart, cursorPos);

      // 1. Check [[Wiki-Link trigger first
      const wikiMatch = /\[\[([^[\]\n]*)$/.exec(linePrefix);
      if (wikiMatch) {
        const triggerIndex = lineStart + wikiMatch.index;
        const query = wikiMatch[1] ?? "";
        const position = computeMenuPosition(textarea, cursorPos);
        setWikiIndex(0);
        setWikiState({ open: true, query, triggerIndex, position });
        setSlashState(CLOSED_TRIGGER);
        return;
      }
      setWikiState((prev) => (prev.open ? CLOSED_TRIGGER : prev));

      // 2. Check /Slash command trigger
      const slashMatch = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(linePrefix);
      if (slashMatch) {
        const slashOffsetInLine = slashMatch[0].startsWith("/") ? 0 : 1;
        const triggerIndex = lineStart + slashMatch.index + slashOffsetInLine;
        const query = slashMatch[1] ?? "";
        const position = computeMenuPosition(textarea, cursorPos);
        setSlashIndex(0);
        setSlashState({ open: true, query, triggerIndex, position });
        return;
      }
      setSlashState((prev) => (prev.open ? CLOSED_TRIGGER : prev));
    },
    [computeMenuPosition]
  );

  const applySlashCommand = useCallback(
    (cmd: SlashCommand) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const start =
        slashState.open && slashState.triggerIndex >= 0
          ? slashState.triggerIndex
          : cursorPos;
      const before = content.slice(0, start);
      const after = content.slice(cursorPos);
      const nextContent = `${before}${cmd.snippet}${after}`;
      const nextCursor =
        before.length + cmd.snippet.length + (cmd.cursorOffset ?? 0);

      updateActiveDoc({ content: nextContent });
      setSlashState(CLOSED_TRIGGER);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [content, slashState.open, slashState.triggerIndex, updateActiveDoc]
  );

  const applyWikiLink = useCallback(
    (docTitle: string, createMissing = false) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (createMissing && activeDoc) {
        const newDoc: BriefDocument = {
          id: makeId("doc"),
          spaceId: activeDoc.spaceId,
          title: docTitle,
          content: `# ${docTitle}\n\n`,
          updatedAt: new Date().toISOString(),
        };
        setDocuments((prev) => [...prev, newDoc]);
      }

      const cursorPos = textarea.selectionStart;
      const start =
        wikiState.open && wikiState.triggerIndex >= 0
          ? wikiState.triggerIndex
          : cursorPos;
      const before = content.slice(0, start);
      const rawAfter = content.slice(cursorPos);
      // Avoid duplicate closing ]] if the user or auto-closer already typed it
      const after = rawAfter.startsWith("]]") ? rawAfter.slice(2) : rawAfter;
      const insertion = `[[${docTitle}]]`;
      const nextContent = `${before}${insertion}${after}`;
      const nextCursor = before.length + insertion.length;

      updateActiveDoc({ content: nextContent });
      setWikiState(CLOSED_TRIGGER);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [
      activeDoc,
      content,
      updateActiveDoc,
      wikiState.open,
      wikiState.triggerIndex,
    ]
  );

  const insertSnippetAtCursor = useCallback(
    (snippet: string, cursorOffset = 0) => {
      if (viewMode === "preview") setViewMode("split");
      const textarea = textareaRef.current;
      if (!textarea) {
        updateActiveDoc({ content: `${content}\n\n${snippet}` });
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = content.slice(0, start);
      const after = content.slice(end);
      const prefix = before && !before.endsWith("\n") ? "\n" : "";
      const nextContent = `${before}${prefix}${snippet}${after}`;
      const nextCursor =
        before.length + prefix.length + snippet.length + cursorOffset;

      updateActiveDoc({ content: nextContent });
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [content, updateActiveDoc, viewMode]
  );

  const wrapSelection = useCallback(
    (wrapper: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.slice(start, end);
      const nextContent = `${content.slice(0, start)}${wrapper}${selected}${wrapper}${content.slice(end)}`;
      updateActiveDoc({ content: nextContent });
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + wrapper.length,
          end + wrapper.length
        );
      });
    },
    [content, updateActiveDoc]
  );

  const handleCreateDoc = useCallback(
    (spaceId: string, customTitle?: string) => {
      const docTitle = customTitle?.trim() || "Untitled Page";
      const newDoc: BriefDocument = {
        id: makeId("doc"),
        spaceId,
        title: docTitle,
        content: `# ${docTitle}\n\n`,
        updatedAt: new Date().toISOString(),
      };
      setDocuments((prev) => [...prev, newDoc]);
      setActiveDocId(newDoc.id);
      if (viewMode === "preview") setViewMode("split");
    },
    [viewMode]
  );

  const handleDeleteDoc = useCallback(
    (docId: string) => {
      setDocuments((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((d) => d.id !== docId);
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
        handleCreateDoc(activeDoc.spaceId, targetTitle.trim());
      }
    },
    [activeDoc, documents, handleCreateDoc]
  );

  const handleCopyDocument = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 1800);
    } catch {
      // Clipboard may be unavailable
    }
  }, [content]);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (wikiState.open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setWikiIndex((prev) =>
          wikiTotalOptions === 0 ? 0 : (prev + 1) % wikiTotalOptions
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setWikiIndex((prev) =>
          wikiTotalOptions === 0
            ? 0
            : (prev - 1 + wikiTotalOptions) % wikiTotalOptions
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (wikiIndex < filteredWikiDocs.length) {
          e.preventDefault();
          applyWikiLink(filteredWikiDocs[wikiIndex].title);
          return;
        }
        if (wikiIndex === filteredWikiDocs.length && wikiState.query.trim()) {
          e.preventDefault();
          applyWikiLink(wikiState.query.trim(), true);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setWikiState(CLOSED_TRIGGER);
        return;
      }
    }

    if (slashState.open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((prev) =>
          filteredSlashCommands.length === 0
            ? 0
            : (prev + 1) % filteredSlashCommands.length
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((prev) =>
          filteredSlashCommands.length === 0
            ? 0
            : (prev - 1 + filteredSlashCommands.length) %
              filteredSlashCommands.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (filteredSlashCommands[slashIndex]) {
          e.preventDefault();
          applySlashCommand(filteredSlashCommands[slashIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashState(CLOSED_TRIGGER);
        return;
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = `${content.slice(0, start)}  ${content.slice(end)}`;
      updateActiveDoc({ content: next });
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        wrapSelection("**");
      } else if (key === "i") {
        e.preventDefault();
        wrapSelection("_");
      } else if (key === "e") {
        e.preventDefault();
        wrapSelection("`");
      }
    }
  };

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
        id: "view-write",
        group: "View",
        label: "Switch to Write Mode",
        description: "Distraction-free Markdown editor only",
        onRun: () => setViewMode("write"),
      },
      {
        id: "view-split",
        group: "View",
        label: "Switch to Split Mode",
        description: "Side-by-side Markdown editor and live preview",
        onRun: () => setViewMode("split"),
      },
      {
        id: "view-preview",
        group: "View",
        label: "Switch to Preview Mode",
        description: "Clean rendered reading view",
        onRun: () => setViewMode("preview"),
      },
      {
        id: "toggle-sidebar",
        group: "View",
        label: sidebarOpen ? "Hide Spaces Sidebar" : "Show Spaces Sidebar",
        description: "Toggle flat Spaces navigation",
        onRun: () => setSidebarOpen((prev) => !prev),
      },
      {
        id: "toggle-focus",
        group: "View",
        label: focusMode ? "Exit Focus Mode" : "Enter Focus Mode",
        description: "Hide chrome for pure Zen writing",
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
        onRun: () => insertSnippetAtCursor(cmd.snippet, cmd.cursorOffset),
      })),
      {
        id: "doc-copy",
        group: "Document",
        label: "Copy Markdown",
        description: "Copy raw Markdown source to clipboard",
        onRun: handleCopyDocument,
      },
      {
        id: "doc-new",
        group: "Document",
        label: "New Page in Current Space",
        description: `Create a blank page in ${activeSpace?.name ?? "Space"}`,
        onRun: () => {
          if (activeDoc) handleCreateDoc(activeDoc.spaceId);
        },
      },
      {
        id: "doc-reset",
        group: "Document",
        label: "Reset Demo Workspace",
        description: "Restore default Spaces and sample docs",
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
    insertSnippetAtCursor,
    sidebarOpen,
    spaces,
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
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className={`rounded-lg border p-1.5 transition-colors ${
                  sidebarOpen
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
                }`}
                title="Toggle Spaces sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f766e] text-sm font-bold text-white shadow-xs">
                B
              </span>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="hidden text-sm font-semibold tracking-tight text-zinc-900 sm:inline">
                  Brief
                </span>
                {activeSpace && (
                  <>
                    <span className="hidden text-zinc-300 sm:inline">/</span>
                    <span className="hidden rounded-md border border-zinc-200 bg-zinc-100/70 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 sm:inline">
                      {activeSpace.name}
                    </span>
                  </>
                )}
                <span className="text-zinc-300">/</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => updateActiveDoc({ title: e.target.value })}
                  aria-label="Document title"
                  className="min-w-[120px] max-w-xs truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-zinc-800 hover:border-zinc-200 focus:border-teal-700 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100/70 p-0.5"
                role="tablist"
                aria-label="Editor view mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "write"}
                  onClick={() => setViewMode("write")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "write"
                      ? "bg-white text-teal-700 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Write</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "split"}
                  onClick={() => setViewMode("split")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "split"
                      ? "bg-white text-teal-700 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Split</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "preview"}
                  onClick={() => setViewMode("preview")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "preview"
                      ? "bg-white text-teal-700 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>

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
                onClick={handleCopyDocument}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100/70"
                title="Copy Markdown"
              >
                {copiedDoc ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="hidden lg:inline">
                  {copiedDoc ? "Copied" : "Copy MD"}
                </span>
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
                className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 xl:inline-flex"
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
            onCreateDoc={(spaceId) => handleCreateDoc(spaceId)}
            onDeleteDoc={handleDeleteDoc}
            onCreateSpace={handleCreateSpace}
          />
        )}

        <main className="flex flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6">
          <div
            className={`mx-auto grid w-full max-w-6xl flex-1 gap-5 ${
              viewMode === "split" ? "lg:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {viewMode !== "preview" && (
              <section
                className={`relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white ${
                  viewMode === "write" ? "mx-auto w-full max-w-3xl" : ""
                }`}
              >
                <div className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-100/70 px-4 py-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">Markdown</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeDoc) handleCreateDoc(activeDoc.spaceId);
                      }}
                      className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900"
                      title="New page in current space"
                    >
                      <FilePlus2 className="h-3.5 w-3.5" />
                      New
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSpaces(DEFAULT_SPACES);
                        setDocuments(DEFAULT_DOCUMENTS);
                        setActiveDocId(DEFAULT_DOCUMENTS[0].id);
                      }}
                      className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900"
                      title="Reset demo workspace"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  </div>
                </div>

                <div className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      updateActiveDoc({ content: nextVal });
                      detectEditorTriggers(
                        nextVal,
                        e.target.selectionStart,
                        e.target
                      );
                    }}
                    onClick={(e) => {
                      detectEditorTriggers(
                        e.currentTarget.value,
                        e.currentTarget.selectionStart,
                        e.currentTarget
                      );
                    }}
                    onKeyDown={handleEditorKeyDown}
                    spellCheck={false}
                    placeholder="Start writing Markdown... Type / for blocks & templates, [[ to link a document, or Cmd+K for palette."
                    className="h-full min-h-[70vh] w-full resize-none bg-white p-6 font-mono text-[14px] leading-6 text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                  />

                  {slashState.open && (
                    <SlashCommandMenu
                      commands={filteredSlashCommands}
                      activeIndex={slashIndex}
                      position={slashState.position}
                      onSelect={applySlashCommand}
                      onHover={setSlashIndex}
                    />
                  )}

                  {wikiState.open && (
                    <WikiLinkMenu
                      query={wikiState.query}
                      documents={filteredWikiDocs}
                      spaces={spaces}
                      activeIndex={wikiIndex}
                      position={wikiState.position}
                      onSelectDoc={(docTitle) => applyWikiLink(docTitle)}
                      onCreateAndLink={(docTitle) =>
                        applyWikiLink(docTitle, true)
                      }
                      onHover={setWikiIndex}
                    />
                  )}
                </div>
              </section>
            )}

            {viewMode !== "write" && (
              <section
                className={`flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white ${
                  viewMode === "preview" ? "mx-auto w-full max-w-3xl" : ""
                }`}
              >
                <div className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-100/70 px-4 py-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">Preview</span>
                  <div className="flex items-center gap-2">
                    {backlinks.length > 0 && (
                      <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        {backlinks.length}{" "}
                        {backlinks.length === 1 ? "Backlink" : "Backlinks"}
                      </span>
                    )}
                    <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      Syntax + Mermaid
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                  <MarkdownPreview
                    content={content}
                    documents={documents}
                    backlinks={backlinks}
                    onNavigateDoc={setActiveDocId}
                    onOpenOrCreateWikiLink={handleOpenOrCreateWikiLink}
                  />
                </div>
              </section>
            )}
          </div>
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
