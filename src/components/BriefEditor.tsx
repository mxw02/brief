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
  PenLine,
  RotateCcw,
} from "lucide-react";
import {
  DEFAULT_DOCUMENT_CONTENT,
  DEFAULT_DOCUMENT_TITLE,
} from "@/lib/default-document";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/slash-commands";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { MarkdownPreview } from "./MarkdownPreview";
import { SlashCommandMenu } from "./SlashCommandMenu";

type ViewMode = "write" | "split" | "preview";

const STORAGE_TITLE_KEY = "brief:doc:title";
const STORAGE_CONTENT_KEY = "brief:doc:content";

interface SlashState {
  open: boolean;
  query: string;
  triggerIndex: number;
  position: { top: number; left: number };
}

export function BriefEditor() {
  const [title, setTitle] = useState(DEFAULT_DOCUMENT_TITLE);
  const [content, setContent] = useState(DEFAULT_DOCUMENT_CONTENT);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashState, setSlashState] = useState<SlashState>({
    open: false,
    query: "",
    triggerIndex: -1,
    position: { top: 48, left: 24 },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore persisted draft on mount
  useEffect(() => {
    try {
      const savedTitle = localStorage.getItem(STORAGE_TITLE_KEY);
      const savedContent = localStorage.getItem(STORAGE_CONTENT_KEY);
      if (savedTitle !== null) setTitle(savedTitle);
      if (savedContent !== null) setContent(savedContent);
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TITLE_KEY, title);
    } catch {
      // Ignore storage restrictions
    }
  }, [title]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONTENT_KEY, content);
    } catch {
      // Ignore storage restrictions
    }
  }, [content]);

  // Global keyboard shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+\)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSlashState((prev) => ({ ...prev, open: false }));
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

  useEffect(() => {
    if (slashIndex >= filteredSlashCommands.length) {
      setSlashIndex(0);
    }
  }, [slashIndex, filteredSlashCommands.length]);

  const computeMenuPosition = useCallback(
    (textarea: HTMLTextAreaElement, cursorPos: number) => {
      const textBefore = textarea.value.slice(0, cursorPos);
      const lines = textBefore.split("\n");
      const currentLineIndex = lines.length - 1;
      const lineHeight = 24;
      const approxTop =
        Math.min(
          Math.max(36, (currentLineIndex + 1) * lineHeight - textarea.scrollTop + 12),
          Math.max(120, textarea.clientHeight - 160)
        );
      const approxLeft = Math.min(
        24 + (lines[currentLineIndex]?.length ?? 0) * 7,
        Math.max(24, textarea.clientWidth - 300)
      );
      return { top: approxTop, left: approxLeft };
    },
    []
  );

  const detectSlashTrigger = useCallback(
    (value: string, cursorPos: number, textarea: HTMLTextAreaElement) => {
      const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;
      const linePrefix = value.slice(lineStart, cursorPos);
      const match = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(linePrefix);

      if (!match) {
        setSlashState((prev) => (prev.open ? { ...prev, open: false } : prev));
        return;
      }

      const slashOffsetInLine = match[0].startsWith("/") ? 0 : 1;
      const triggerIndex = lineStart + match.index + slashOffsetInLine;
      const query = match[1] ?? "";
      const position = computeMenuPosition(textarea, cursorPos);

      setSlashIndex(0);
      setSlashState({
        open: true,
        query,
        triggerIndex,
        position,
      });
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

      setContent(nextContent);
      setSlashState((prev) => ({ ...prev, open: false }));

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [content, slashState.open, slashState.triggerIndex]
  );

  const insertSnippetAtCursor = useCallback(
    (snippet: string, cursorOffset = 0) => {
      if (viewMode === "preview") {
        setViewMode("split");
      }
      const textarea = textareaRef.current;
      if (!textarea) {
        setContent((prev) => `${prev}\n\n${snippet}`);
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

      setContent(nextContent);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [content, viewMode]
  );

  const wrapSelection = useCallback(
    (wrapper: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.slice(start, end);
      const nextContent = `${content.slice(0, start)}${wrapper}${selected}${wrapper}${content.slice(end)}`;
      setContent(nextContent);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + wrapper.length,
          end + wrapper.length
        );
      });
    },
    [content]
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
        setSlashState((prev) => ({ ...prev, open: false }));
        return;
      }
    }

    // Tab inserts 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const next = `${content.slice(0, start)}  ${content.slice(end)}`;
      setContent(next);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
      return;
    }

    // Formatting shortcuts: Cmd/Ctrl + B / I / E
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

  const paletteActions: PaletteAction[] = useMemo(
    () => [
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
        label: "New Blank Document",
        description: "Clear editor and start a fresh page",
        onRun: () => {
          setTitle("Untitled Document");
          setContent("# Untitled Document\n\n");
          setViewMode("write");
        },
      },
      {
        id: "doc-reset",
        group: "Document",
        label: "Restore Demo Spec",
        description: "Load the default Brief architecture spec",
        onRun: () => {
          setTitle(DEFAULT_DOCUMENT_TITLE);
          setContent(DEFAULT_DOCUMENT_CONTENT);
        },
      },
    ],
    [focusMode, handleCopyDocument, insertSnippetAtCursor]
  );

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
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f766e] text-sm font-bold text-white shadow-xs">
                B
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-zinc-900">
                  Brief
                </span>
                <span className="text-zinc-300">/</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Document title"
                  className="min-w-[140px] max-w-xs truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-zinc-700 hover:border-zinc-200 focus:border-teal-700 focus:bg-white focus:outline-none"
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 sm:px-6">
        <div
          className={`grid flex-1 gap-5 ${
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
                      setTitle("Untitled Document");
                      setContent("# Untitled Document\n\n");
                      textareaRef.current?.focus();
                    }}
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900"
                    title="New blank page"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(DEFAULT_DOCUMENT_TITLE);
                      setContent(DEFAULT_DOCUMENT_CONTENT);
                    }}
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900"
                    title="Restore sample spec"
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
                    setContent(nextVal);
                    detectSlashTrigger(
                      nextVal,
                      e.target.selectionStart,
                      e.target
                    );
                  }}
                  onClick={(e) => {
                    detectSlashTrigger(
                      e.currentTarget.value,
                      e.currentTarget.selectionStart,
                      e.currentTarget
                    );
                  }}
                  onKeyDown={handleEditorKeyDown}
                  spellCheck={false}
                  placeholder="Start writing Markdown... Type / for commands or Cmd+K for palette."
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
                <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                  Syntax + Mermaid
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <MarkdownPreview content={content} />
              </div>
            </section>
          )}
        </div>
      </main>

      {!focusMode && (
        <footer className="border-t border-zinc-200/80 bg-white px-4 py-2 text-xs text-zinc-500 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
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
                blocks
              </span>
              <span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-600">
                  ⌘K
                </kbd>{" "}
                palette
              </span>
              <span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-600">
                  ⌘B
                </kbd>{" "}
                bold
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
