"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EditorContent,
  ReactNodeViewRenderer,
  useEditor,
} from "@tiptap/react";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { KanbanSquare, Loader2, MessageSquarePlus, X } from "lucide-react";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown-bridge";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/slash-commands";
import { BRIEF_DOC_HREF_PREFIX, type BriefDocument, type Space } from "@/lib/workspace";
import type { KansoIssueSummary } from "@/lib/kanso";
import { RichCodeBlock } from "./RichCodeBlock";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { WikiLinkMenu } from "./WikiLinkMenu";
import { KansoTicketMenu } from "./KansoTicketMenu";

const lowlight = createLowlight(common);

const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(RichCodeBlock);
  },
}).configure({
  lowlight,
  defaultLanguage: "typescript",
});

const KANSO_INLINE_TICKET_RE = /(?:^|[\s(])(#([A-Z][A-Z0-9]{1,9}-\d+))\b/g;

function createKansoTicketDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") return false;
    if (!node.isText || !node.text) return true;
    if (node.marks.some((mark) => mark.type.name === "code")) return true;

    KANSO_INLINE_TICKET_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = KANSO_INLINE_TICKET_RE.exec(node.text)) !== null) {
      const fullMatch = match[0];
      const chipText = match[1];
      const ticketId = match[2];
      const chipOffset = fullMatch.length - chipText.length;
      const from = pos + match.index + chipOffset;
      const to = from + chipText.length;
      decorations.push(
        Decoration.inline(from, to, {
          class: "kanso-ticket-chip",
          "data-kanso-ticket": ticketId,
        })
      );
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
}

const KansoTicketHighlight = Extension.create({
  name: "kansoTicketHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("kansoTicketHighlight"),
        state: {
          init: (_, state) => createKansoTicketDecorations(state.doc),
          apply: (tr, oldSet) =>
            tr.docChanged ? createKansoTicketDecorations(tr.doc) : oldSet,
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export interface RichDocumentEditorHandle {
  insertMarkdownSnippet: (snippet: string) => void;
  focus: () => void;
  focusQuote: (quote: string, from?: number, to?: number) => boolean;
}

interface RichDocumentEditorProps {
  docId: string;
  docTitle?: string;
  content: string;
  documents: BriefDocument[];
  spaces: Space[];
  readOnly?: boolean;
  onChangeMarkdown: (markdown: string) => void;
  onOpenOrCreateWikiLink: (targetTitle: string) => void;
  onCreateAndLinkDoc: (title: string) => void;
  onAddInlineComment?: (
    quote: string,
    body: string,
    from?: number,
    to?: number
  ) => void;
}

interface TriggerState {
  open: boolean;
  query: string;
  from: number;
  to: number;
  position: { top: number; left: number };
}

const CLOSED_TRIGGER: TriggerState = {
  open: false,
  query: "",
  from: 0,
  to: 0,
  position: { top: 48, left: 24 },
};

export const RichDocumentEditor = forwardRef<
  RichDocumentEditorHandle,
  RichDocumentEditorProps
>(function RichDocumentEditor(
  {
    docId,
    docTitle,
    content,
    documents,
    spaces,
    readOnly = false,
    onChangeMarkdown,
    onOpenOrCreateWikiLink,
    onCreateAndLinkDoc,
    onAddInlineComment,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastLoadedDocIdRef = useRef<string>(docId);
  const isApplyingExternalRef = useRef(false);

  const [slashIndex, setSlashIndex] = useState(0);
  const [slashState, setSlashState] = useState<TriggerState>(CLOSED_TRIGGER);

  const [wikiIndex, setWikiIndex] = useState(0);
  const [wikiState, setWikiState] = useState<TriggerState>(CLOSED_TRIGGER);

  const [kansoIndex, setKansoIndex] = useState(0);
  const [kansoState, setKansoState] = useState<TriggerState>(CLOSED_TRIGGER);
  const [kansoIssues, setKansoIssues] = useState<KansoIssueSummary[]>([]);
  const [kansoLoading, setKansoLoading] = useState(false);
  const [kansoUnreachable, setKansoUnreachable] = useState(false);
  const kansoStateRef = useRef(kansoState);
  kansoStateRef.current = kansoState;
  const kansoIndexRef = useRef(kansoIndex);
  kansoIndexRef.current = kansoIndex;
  const kansoIssuesRef = useRef(kansoIssues);
  kansoIssuesRef.current = kansoIssues;

  const [selectionComment, setSelectionComment] = useState<{
    quote: string;
    fullText: string;
    from: number;
    to: number;
    top: number;
    left: number;
    composing: boolean;
    mode: "bar" | "comment" | "kanso";
    draft: string;
    ticketTitle: string;
    ticketDescription: string;
    ticketProjectId: string;
    ticketPriority: string;
    ticketSubmitting: boolean;
    ticketError: string | null;
  } | null>(null);

  const [kansoProjects, setKansoProjects] = useState<
    Array<{ id: string; key: string; name: string }>
  >([]);
  const kansoProjectsRef = useRef(kansoProjects);
  kansoProjectsRef.current = kansoProjects;
  const [kansoProjectsLoading, setKansoProjectsLoading] = useState(false);

  const loadKansoProjects = useCallback(async () => {
    if (kansoProjects.length > 0) return kansoProjects;
    setKansoProjectsLoading(true);
    try {
      const res = await fetch("/api/kanso/projects");
      if (!res.ok) return [];
      const data = (await res.json()) as {
        projects?: Array<{ id: string; key: string; name: string }>;
      };
      const list = Array.isArray(data.projects) ? data.projects : [];
      setKansoProjects(list);
      return list;
    } catch {
      return [];
    } finally {
      setKansoProjectsLoading(false);
    }
  }, [kansoProjects]);

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
    const candidates = documents.filter((d) => d.id !== docId);
    if (!q) return candidates;
    return candidates.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, docId, wikiState.query]);

  const wikiTotalOptions = useMemo(() => {
    const trimmed = wikiState.query.trim();
    const exactExists = filteredWikiDocs.some(
      (d) => d.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    return filteredWikiDocs.length + (trimmed && !exactExists ? 1 : 0);
  }, [filteredWikiDocs, wikiState.query]);

  // Refs for latest state inside TipTap handleKeyDown closure
  const slashStateRef = useRef(slashState);
  slashStateRef.current = slashState;
  const slashIndexRef = useRef(slashIndex);
  slashIndexRef.current = slashIndex;
  const filteredSlashRef = useRef(filteredSlashCommands);
  filteredSlashRef.current = filteredSlashCommands;

  const wikiStateRef = useRef(wikiState);
  wikiStateRef.current = wikiState;
  const wikiIndexRef = useRef(wikiIndex);
  wikiIndexRef.current = wikiIndex;
  const filteredWikiRef = useRef(filteredWikiDocs);
  filteredWikiRef.current = filteredWikiDocs;
  const wikiTotalRef = useRef(wikiTotalOptions);
  wikiTotalRef.current = wikiTotalOptions;

  useEffect(() => {
    if (slashIndex >= filteredSlashCommands.length) setSlashIndex(0);
  }, [slashIndex, filteredSlashCommands.length]);

  useEffect(() => {
    if (wikiIndex >= wikiTotalOptions) setWikiIndex(0);
  }, [wikiIndex, wikiTotalOptions]);

  useEffect(() => {
    if (kansoIndex >= kansoIssues.length) setKansoIndex(0);
  }, [kansoIndex, kansoIssues.length]);

  useEffect(() => {
    if (!kansoState.open) {
      setKansoLoading(false);
      return;
    }

    const controller = new AbortController();
    const delay = kansoState.query ? 120 : 0;
    const timer = window.setTimeout(async () => {
      setKansoLoading(true);
      try {
        const res = await fetch(
          `/api/kanso/issues?q=${encodeURIComponent(kansoState.query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          issues?: KansoIssueSummary[];
          unreachable?: boolean;
        };
        if (!controller.signal.aborted) {
          setKansoIssues(Array.isArray(data.issues) ? data.issues : []);
          setKansoUnreachable(Boolean(data.unreachable));
          setKansoIndex(0);
        }
      } catch {
        // Ignore aborts
      } finally {
        if (!controller.signal.aborted) {
          setKansoLoading(false);
        }
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kansoState.open, kansoState.query]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          "Start writing, or type / for blocks & templates, [[ to link a page...",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CustomCodeBlock,
      KansoTicketHighlight,
    ],
    content: markdownToHtml(content),
    editorProps: {
      attributes: {
        class: "brief-rich-editor focus:outline-none min-h-[62vh]",
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest("a");
        if (!anchor) return false;
        const href = anchor.getAttribute("href") ?? "";
        if (href.startsWith(BRIEF_DOC_HREF_PREFIX)) {
          event.preventDefault();
          const title = decodeURIComponent(
            href.slice(BRIEF_DOC_HREF_PREFIX.length)
          );
          onOpenOrCreateWikiLink(title);
          return true;
        }
        if (href.startsWith("/api/uploads/")) {
          event.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        if (wikiStateRef.current.open) {
          const total = wikiTotalRef.current;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setWikiIndex((prev) => (total === 0 ? 0 : (prev + 1) % total));
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setWikiIndex((prev) =>
              total === 0 ? 0 : (prev - 1 + total) % total
            );
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            const idx = wikiIndexRef.current;
            const docs = filteredWikiRef.current;
            if (idx < docs.length) {
              event.preventDefault();
              applyWikiSelectionRef.current(docs[idx].title, false);
              return true;
            }
            if (idx === docs.length && wikiStateRef.current.query.trim()) {
              event.preventDefault();
              applyWikiSelectionRef.current(
                wikiStateRef.current.query.trim(),
                true
              );
              return true;
            }
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setWikiState(CLOSED_TRIGGER);
            return true;
          }
        }

        if (slashStateRef.current.open) {
          const cmds = filteredSlashRef.current;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSlashIndex((prev) =>
              cmds.length === 0 ? 0 : (prev + 1) % cmds.length
            );
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSlashIndex((prev) =>
              cmds.length === 0 ? 0 : (prev - 1 + cmds.length) % cmds.length
            );
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            const cmd = cmds[slashIndexRef.current];
            if (cmd) {
              event.preventDefault();
              applySlashSelectionRef.current(cmd);
              return true;
            }
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setSlashState(CLOSED_TRIGGER);
            return true;
          }
        }

        if (kansoStateRef.current.open) {
          const issues = kansoIssuesRef.current;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setKansoIndex((prev) =>
              issues.length === 0 ? 0 : (prev + 1) % issues.length
            );
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setKansoIndex((prev) =>
              issues.length === 0
                ? 0
                : (prev - 1 + issues.length) % issues.length
            );
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            const issue = issues[kansoIndexRef.current];
            if (issue) {
              event.preventDefault();
              applyKansoSelectionRef.current(issue);
              return true;
            }
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setKansoState(CLOSED_TRIGGER);
            return true;
          }
        }

        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isApplyingExternalRef.current) return;
      const md = htmlToMarkdown(ed.getHTML());
      onChangeMarkdown(md);
      detectTriggers(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      detectTriggers(ed);
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== !readOnly) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  const getCursorCoords = useCallback(
    (pos: number): { top: number; left: number } => {
      if (!editor || !containerRef.current) return { top: 48, left: 24 };
      try {
        const coords = editor.view.coordsAtPos(pos);
        const rect = containerRef.current.getBoundingClientRect();
        return {
          top: Math.max(16, coords.bottom - rect.top + 8),
          left: Math.min(
            Math.max(16, coords.left - rect.left),
            Math.max(16, rect.width - 336)
          ),
        };
      } catch {
        return { top: 48, left: 24 };
      }
    },
    [editor]
  );

  const detectTriggers = useCallback(
    (ed: NonNullable<typeof editor>) => {
      const { state } = ed;
      const { from, to, empty } = state.selection;
      if (!empty) {
        setSlashState((p) => (p.open ? CLOSED_TRIGGER : p));
        setWikiState((p) => (p.open ? CLOSED_TRIGGER : p));
        setKansoState((p) => (p.open ? CLOSED_TRIGGER : p));
        const selectedText = state.doc.textBetween(from, to, "\n").trim();
        if (selectedText) {
          const coords = getCursorCoords(from);
          const firstLine = selectedText.split("\n")[0]?.trim() || selectedText;
          setSelectionComment((prev) =>
            prev?.composing
              ? prev
              : {
                  quote: selectedText.replace(/\s+/g, " ").slice(0, 140),
                  fullText: selectedText,
                  from,
                  to,
                  top: Math.max(8, coords.top - 64),
                  left: Math.min(coords.left, 420),
                  composing: false,
                  mode: "bar",
                  draft: "",
                  ticketTitle: firstLine.slice(0, 100),
                  ticketDescription: selectedText,
                  ticketProjectId: kansoProjectsRef.current[0]?.id ?? "",
                  ticketPriority: "MEDIUM",
                  ticketSubmitting: false,
                  ticketError: null,
                }
          );
        }
        return;
      }

      setSelectionComment((prev) => (prev?.composing ? prev : null));

      const $from = state.selection.$from;
      // Don't trigger inside code blocks
      if ($from.parent.type.name === "codeBlock") {
        setSlashState((p) => (p.open ? CLOSED_TRIGGER : p));
        setWikiState((p) => (p.open ? CLOSED_TRIGGER : p));
        setKansoState((p) => (p.open ? CLOSED_TRIGGER : p));
        return;
      }

      const blockStart = $from.start();
      const textBefore = state.doc.textBetween(blockStart, from, "\n", "\0");

      const wikiMatch = /\[\[([^[\]\n]*)$/.exec(textBefore);
      if (wikiMatch) {
        const triggerStart = from - wikiMatch[0].length;
        setWikiIndex(0);
        setWikiState({
          open: true,
          query: wikiMatch[1] ?? "",
          from: triggerStart,
          to: from,
          position: getCursorCoords(from),
        });
        setSlashState(CLOSED_TRIGGER);
        setKansoState(CLOSED_TRIGGER);
        return;
      }
      setWikiState((p) => (p.open ? CLOSED_TRIGGER : p));

      const slashMatch = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(textBefore);
      if (slashMatch) {
        const offset = slashMatch[0].startsWith("/") ? 0 : 1;
        const triggerStart = from - slashMatch[0].length + offset;
        setSlashIndex(0);
        setSlashState({
          open: true,
          query: slashMatch[1] ?? "",
          from: triggerStart,
          to: from,
          position: getCursorCoords(from),
        });
        setKansoState(CLOSED_TRIGGER);
        return;
      }
      setSlashState((p) => (p.open ? CLOSED_TRIGGER : p));

      const kansoMatch = /(?:^|[\s(])#([A-Za-z0-9-]*)$/.exec(textBefore);
      if (kansoMatch) {
        const offset = kansoMatch[0].startsWith("#") ? 0 : 1;
        const triggerStart = from - kansoMatch[0].length + offset;
        setKansoIndex(0);
        setKansoState({
          open: true,
          query: kansoMatch[1] ?? "",
          from: triggerStart,
          to: from,
          position: getCursorCoords(from),
        });
        return;
      }
      setKansoState((p) => (p.open ? CLOSED_TRIGGER : p));
    },
    [getCursorCoords]
  );

  const applySlashCommand = useCallback(
    (cmd: SlashCommand) => {
      if (!editor) return;
      const { from, to } = slashStateRef.current;
      setSlashState(CLOSED_TRIGGER);

      const html = markdownToHtml(cmd.snippet);
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(html)
        .run();
    },
    [editor]
  );

  const applyWikiLink = useCallback(
    (docTitle: string, createMissing: boolean) => {
      if (!editor) return;
      const { from, to } = wikiStateRef.current;
      setWikiState(CLOSED_TRIGGER);

      if (createMissing) {
        onCreateAndLinkDoc(docTitle);
      }

      const href = `${BRIEF_DOC_HREF_PREFIX}${encodeURIComponent(docTitle)}`;
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(
          `<a href="${href}">${docTitle}</a> `
        )
        .run();
    },
    [editor, onCreateAndLinkDoc]
  );

  const applySlashSelectionRef = useRef(applySlashCommand);
  applySlashSelectionRef.current = applySlashCommand;
  const applyWikiSelectionRef = useRef(applyWikiLink);
  applyWikiSelectionRef.current = applyWikiLink;

  const applyKansoTicket = useCallback(
    (issue: KansoIssueSummary) => {
      if (!editor) return;
      const { from, to } = kansoStateRef.current;
      setKansoState(CLOSED_TRIGGER);

      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(`#${issue.identifier} `)
        .run();
    },
    [editor]
  );

  const applyKansoSelectionRef = useRef(applyKansoTicket);
  applyKansoSelectionRef.current = applyKansoTicket;

  // Sync editor content when switching documents or resetting workspace
  useEffect(() => {
    if (!editor) return;
    if (lastLoadedDocIdRef.current !== docId) {
      lastLoadedDocIdRef.current = docId;
      isApplyingExternalRef.current = true;
      editor.commands.setContent(markdownToHtml(content), { emitUpdate: false });
      isApplyingExternalRef.current = false;
      setSlashState(CLOSED_TRIGGER);
      setWikiState(CLOSED_TRIGGER);
    }
  }, [docId, content, editor]);

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdownSnippet: (snippet: string) => {
        if (!editor) return;
        const html = markdownToHtml(snippet);
        editor.chain().focus().insertContent(html).run();
      },
      focus: () => {
        editor?.commands.focus();
      },
      focusQuote: (quote: string, from?: number, to?: number) => {
        if (!editor) return false;
        const doc = editor.state.doc;
        let matchFrom = -1;
        let matchTo = -1;

        if (
          typeof from === "number" &&
          typeof to === "number" &&
          from >= 0 &&
          to <= doc.content.size &&
          doc.textBetween(from, to, " ").trim() === quote.trim()
        ) {
          matchFrom = from;
          matchTo = to;
        } else if (quote.trim()) {
          const needle = quote.trim().toLowerCase();
          doc.descendants((node, pos) => {
            if (matchFrom !== -1) return false;
            if (!node.isText || !node.text) return true;
            const idx = node.text.toLowerCase().indexOf(needle);
            if (idx !== -1) {
              matchFrom = pos + idx;
              matchTo = matchFrom + needle.length;
              return false;
            }
            return true;
          });
        }

        if (matchFrom === -1 || matchTo === -1) return false;

        editor.chain().focus().setTextSelection({ from: matchFrom, to: matchTo }).run();
        const domAt = editor.view.domAtPos(matchFrom);
        const el =
          domAt.node instanceof HTMLElement
            ? domAt.node
            : domAt.node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      },
    }),
    [editor]
  );

  return (
    <div ref={containerRef} className="relative flex-1">
      <EditorContent editor={editor} />

      {selectionComment && (
        <div
          style={{ top: selectionComment.top, left: selectionComment.left }}
          className="absolute z-30 rounded-xl border border-zinc-200 bg-white shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {selectionComment.mode === "bar" ? (
            <div className="flex items-center divide-x divide-zinc-200">
              {onAddInlineComment && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectionComment((prev) =>
                      prev ? { ...prev, composing: true, mode: "comment" } : null
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:text-teal-700"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5 text-teal-700" />
                  Comment
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  setSelectionComment((prev) =>
                    prev ? { ...prev, composing: true, mode: "kanso" } : null
                  );
                  const list = await loadKansoProjects();
                  if (list.length > 0) {
                    const preferred =
                      list.find((p) => p.key === "BRIE") ?? list[0];
                    setSelectionComment((prev) =>
                      prev && !prev.ticketProjectId
                        ? { ...prev, ticketProjectId: preferred.id }
                        : prev
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:text-teal-700"
              >
                <KanbanSquare className="h-3.5 w-3.5 text-teal-700" />
                In Kanso-Ticket umwandeln
              </button>
            </div>
          ) : selectionComment.mode === "comment" && onAddInlineComment ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = selectionComment.draft.trim();
                if (!text) return;
                onAddInlineComment(
                  selectionComment.quote,
                  text,
                  selectionComment.from,
                  selectionComment.to
                );
                setSelectionComment(null);
              }}
              className="w-72 p-2.5"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] italic text-zinc-400">
                  &ldquo;{selectionComment.quote}&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => setSelectionComment(null)}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={selectionComment.draft}
                onChange={(e) =>
                  setSelectionComment((prev) =>
                    prev ? { ...prev, draft: e.target.value } : null
                  )
                }
                placeholder="Write a concise comment..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-teal-700 focus:bg-white focus:outline-none"
              />
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectionComment(null)}
                  className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-teal-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-800"
                >
                  Comment
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const title = selectionComment.ticketTitle.trim();
                const projectId = selectionComment.ticketProjectId.trim();
                if (!title || !projectId || selectionComment.ticketSubmitting) {
                  return;
                }
                setSelectionComment((prev) =>
                  prev
                    ? { ...prev, ticketSubmitting: true, ticketError: null }
                    : null
                );
                try {
                  const res = await fetch("/api/kanso/issues", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      projectId,
                      title,
                      description: selectionComment.ticketDescription,
                      priority: selectionComment.ticketPriority,
                      docId,
                      docTitle: docTitle || "Untitled Page",
                      sourceUrl:
                        typeof window !== "undefined"
                          ? window.location.href
                          : undefined,
                    }),
                  });
                  const data = (await res.json()) as {
                    issue?: KansoIssueSummary;
                    error?: string;
                  };
                  if (!res.ok || !data.issue?.identifier) {
                    setSelectionComment((prev) =>
                      prev
                        ? {
                            ...prev,
                            ticketSubmitting: false,
                            ticketError:
                              data.error || "Ticket konnte nicht erstellt werden",
                          }
                        : null
                    );
                    return;
                  }

                  const insertAt = selectionComment.to;
                  const refText = ` #${data.issue.identifier}`;
                  setSelectionComment(null);
                  editor
                    ?.chain()
                    .focus()
                    .insertContentAt(insertAt, refText)
                    .run();
                } catch {
                  setSelectionComment((prev) =>
                    prev
                      ? {
                          ...prev,
                          ticketSubmitting: false,
                          ticketError: "Kanso ist nicht erreichbar",
                        }
                      : null
                  );
                }
              }}
              className="w-80 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
                  <KanbanSquare className="h-3.5 w-3.5 text-teal-700" />
                  In Kanso-Ticket umwandeln
                </span>
                <button
                  type="button"
                  onClick={() => setSelectionComment(null)}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Projekt
                  </label>
                  <select
                    value={selectionComment.ticketProjectId}
                    disabled={kansoProjectsLoading}
                    onChange={(e) =>
                      setSelectionComment((prev) =>
                        prev
                          ? { ...prev, ticketProjectId: e.target.value }
                          : null
                      )
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-teal-700 focus:bg-white focus:outline-none"
                  >
                    {kansoProjects.length === 0 ? (
                      <option value="">
                        {kansoProjectsLoading
                          ? "Lade Projekte..."
                          : "Keine Projekte gefunden"}
                      </option>
                    ) : (
                      kansoProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.key} — {p.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Titel
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={selectionComment.ticketTitle}
                    onChange={(e) =>
                      setSelectionComment((prev) =>
                        prev ? { ...prev, ticketTitle: e.target.value } : null
                      )
                    }
                    placeholder="Ticket-Titel..."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-teal-700 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Priorität
                  </label>
                  <select
                    value={selectionComment.ticketPriority}
                    onChange={(e) =>
                      setSelectionComment((prev) =>
                        prev
                          ? { ...prev, ticketPriority: e.target.value }
                          : null
                      )
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 focus:border-teal-700 focus:bg-white focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                {selectionComment.ticketError && (
                  <p className="text-[11px] text-rose-600">
                    {selectionComment.ticketError}
                  </p>
                )}
              </div>

              <div className="mt-3 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectionComment(null)}
                  className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={
                    selectionComment.ticketSubmitting ||
                    !selectionComment.ticketProjectId ||
                    !selectionComment.ticketTitle.trim()
                  }
                  className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {selectionComment.ticketSubmitting && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Ticket anlegen
                </button>
              </div>
            </form>
          )}
        </div>
      )}

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
          onSelectDoc={(docTitle) => applyWikiLink(docTitle, false)}
          onCreateAndLink={(docTitle) => applyWikiLink(docTitle, true)}
          onHover={setWikiIndex}
        />
      )}

      {kansoState.open && (
        <KansoTicketMenu
          query={kansoState.query}
          issues={kansoIssues}
          loading={kansoLoading}
          unreachable={kansoUnreachable}
          activeIndex={kansoIndex}
          position={kansoState.position}
          onSelectTicket={applyKansoTicket}
          onHover={setKansoIndex}
        />
      )}
    </div>
  );
});
