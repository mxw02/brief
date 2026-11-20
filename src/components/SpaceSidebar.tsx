"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderPlus,
  Hash,
  Plus,
  Trash2,
} from "lucide-react";
import {
  compareDocumentsByTitle,
  normalizeDocumentStatus,
  SPEC_STATUS_META,
  SPEC_STATUSES,
  type BriefDocument,
  type DocumentStatus,
  type Space,
} from "@/lib/workspace";

interface SpaceSidebarProps {
  spaces: Space[];
  documents: BriefDocument[];
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: (spaceId: string, parentId?: string | null) => void;
  onDeleteDoc: (docId: string) => void;
  onCreateSpace: (name: string) => void;
  onDeleteSpace: (spaceId: string) => void;
  canDeleteSpace?: boolean;
  onPublishAllDrafts?: (spaceId: string) => void;
  onCopySpaceContext: (spaceId: string) => void;
}

interface TreeNodeProps {
  doc: BriefDocument;
  depth: number;
  childrenByParent: Map<string | null, BriefDocument[]>;
  activeDocId: string;
  expandedIds: Set<string>;
  canDelete: boolean;
  onToggleExpand: (docId: string) => void;
  onSelectDoc: (docId: string) => void;
  onCreateChild: (spaceId: string, parentId: string) => void;
  onDeleteDoc: (docId: string) => void;
}

function DocumentTreeNode({
  doc,
  depth,
  childrenByParent,
  activeDocId,
  expandedIds,
  canDelete,
  onToggleExpand,
  onSelectDoc,
  onCreateChild,
  onDeleteDoc,
}: TreeNodeProps) {
  const children = childrenByParent.get(doc.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(doc.id);
  const isActive = doc.id === activeDocId;

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        className={`group flex items-center justify-between rounded-lg border py-1.5 pr-1.5 transition-colors ${
          isActive
            ? "border-teal-200 bg-teal-50 text-teal-800"
            : "border-transparent text-zinc-600 hover:bg-white hover:text-zinc-900"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(doc.id)}
              className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
              aria-label={isExpanded ? "Collapse child pages" : "Expand child pages"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => onSelectDoc(doc.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <FileText
              className={`h-3.5 w-3.5 shrink-0 ${
                isActive ? "text-teal-700" : "text-zinc-400"
              }`}
            />
            <span className="truncate text-xs font-medium">
              {doc.title || "Untitled"}
            </span>
            {(() => {
              const status = normalizeDocumentStatus(doc.status);
              const meta = SPEC_STATUS_META[status];
              return status === "approved" ? (
                <span
                  className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotClass}`}
                  title={meta.label}
                />
              ) : (
                <span
                  className={`ml-auto shrink-0 rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
                >
                  {meta.shortLabel}
                </span>
              );
            })()}
          </button>
        </div>

        <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onCreateChild(doc.spaceId, doc.id)}
            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-teal-700"
            title="Add nested child page"
          >
            <Plus className="h-3 w-3" />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteDoc(doc.id)}
              className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              title="Delete page"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {children.map((child) => (
            <DocumentTreeNode
              key={child.id}
              doc={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              activeDocId={activeDocId}
              expandedIds={expandedIds}
              canDelete={canDelete}
              onToggleExpand={onToggleExpand}
              onSelectDoc={onSelectDoc}
              onCreateChild={onCreateChild}
              onDeleteDoc={onDeleteDoc}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 560;
const SIDEBAR_WIDTH_STORAGE_KEY = "brief.sidebarWidth";

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function SpaceSidebar({
  spaces,
  documents,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onCreateSpace,
  onDeleteSpace,
  canDeleteSpace = true,
  onPublishAllDrafts,
  onCopySpaceContext,
}: SpaceSidebarProps) {
  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [copiedSpaceId, setCopiedSpaceId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) {
          setSidebarWidth(clampSidebarWidth(parsed));
        }
      }
    } catch {
      // Ignore storage unavailability
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStartRef.current;
      if (!drag) return;
      const next = clampSidebarWidth(drag.startWidth + (e.clientX - drag.startX));
      setSidebarWidth(next);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) return;
    try {
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(sidebarWidth)
      );
    } catch {
      // Ignore storage unavailability
    }
  }, [sidebarWidth, isResizing]);

  const expandedIds = useMemo(() => {
    const expanded = new Set<string>();
    for (const d of documents) {
      if (!collapsedIds.has(d.id)) expanded.add(d.id);
    }
    return expanded;
  }, [documents, collapsedIds]);

  const toggleExpand = (docId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const handleAddSpace = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSpaceName.trim();
    if (!trimmed) return;
    onCreateSpace(trimmed);
    setNewSpaceName("");
    setAddingSpace(false);
  };

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative flex shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/70"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Seitenleiste skalieren"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        title="Ziehen zum Anpassen der Breite (Doppelklick zum Zurücksetzen)"
        onPointerDown={(e) => {
          e.preventDefault();
          dragStartRef.current = { startX: e.clientX, startWidth: sidebarWidth };
          setIsResizing(true);
        }}
        onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setSidebarWidth((w) => clampSidebarWidth(w + 16));
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            setSidebarWidth((w) => clampSidebarWidth(w - 16));
          } else if (e.key === "Home") {
            e.preventDefault();
            setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
          }
        }}
        className={`absolute top-0 right-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize transition-colors focus:outline-none ${
          isResizing
            ? "bg-teal-600/60"
            : "hover:bg-teal-500/40 focus-visible:bg-teal-500/50"
        }`}
      />
      <div className="flex items-center justify-between border-b border-zinc-200/80 px-3.5 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Spaces
        </span>
        <button
          type="button"
          onClick={() => setAddingSpace((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-white hover:text-teal-700"
          title="New Space"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Space
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200/80 px-3 py-2">
        <button
          type="button"
          onClick={() => setStatusFilter(null)}
          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            statusFilter === null
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
          }`}
        >
          All
        </button>
        {SPEC_STATUSES.map((st) => {
          const meta = SPEC_STATUS_META[st];
          const active = statusFilter === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(active ? null : st)}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? meta.badgeClass
                  : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
              }`}
              title={`Filter by ${meta.label}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
              {meta.shortLabel}
            </button>
          );
        })}
      </div>

      {addingSpace && (
        <form
          onSubmit={handleAddSpace}
          className="border-b border-zinc-200/80 bg-white p-2.5"
        >
          <input
            type="text"
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            placeholder="Space name (e.g. Design)"
            autoFocus
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-teal-700 focus:bg-white focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAddingSpace(false);
                setNewSpaceName("");
              }}
              className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-800"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Spaces">
        {spaces.map((space) => {
          const spaceDocs = documents.filter((d) => {
            if (d.spaceId !== space.id) return false;
            if (statusFilter && normalizeDocumentStatus(d.status) !== statusFilter) {
              return false;
            }
            return true;
          });
          if (statusFilter && spaceDocs.length === 0) return null;
          const spaceDocIds = new Set(spaceDocs.map((d) => d.id));
          const childrenByParent = new Map<string | null, BriefDocument[]>();

          for (const doc of spaceDocs) {
            const parentKey =
              doc.parentId && spaceDocIds.has(doc.parentId)
                ? doc.parentId
                : null;
            const list = childrenByParent.get(parentKey) ?? [];
            list.push(doc);
            childrenByParent.set(parentKey, list);
          }

          for (const list of childrenByParent.values()) {
            list.sort(compareDocumentsByTitle);
          }

          const rootDocs = childrenByParent.get(null) ?? [];
          const draftCount = documents.filter(
            (d) =>
              d.spaceId === space.id &&
              normalizeDocumentStatus(d.status) === "draft"
          ).length;

          return (
            <div key={space.id}>
              <div className="group mb-1.5 flex items-center justify-between px-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                  <Hash className="h-3.5 w-3.5 text-teal-700" />
                  <span>{space.name}</span>
                  <span className="text-[10px] font-normal text-zinc-400">
                    {spaceDocs.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-75 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      onCopySpaceContext(space.id);
                      setCopiedSpaceId(space.id);
                      setTimeout(() => setCopiedSpaceId(null), 1800);
                    }}
                    className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-white hover:text-emerald-700"
                    title={`Copy ${space.name} Space as Agent Context`}
                  >
                    {copiedSpaceId === space.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateDoc(space.id, null)}
                    className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-white hover:text-teal-700"
                    title={`New page in ${space.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {canDeleteSpace && spaces.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteSpace(space.id)}
                      className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title={`Delete ${space.name} space`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {canDeleteSpace && onPublishAllDrafts && draftCount > 0 && (
                <button
                  type="button"
                  onClick={() => onPublishAllDrafts(space.id)}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
                  title={`Alle ${draftCount} Drafts in "${space.name}" gleichzeitig publishen`}
                >
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-700" />
                  Alle Drafts publishen ({draftCount})
                </button>
              )}

              <div className="space-y-0.5">
                {rootDocs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onCreateDoc(space.id, null)}
                    className="w-full rounded-lg border border-dashed border-zinc-200 px-2.5 py-1.5 text-left text-[11px] text-zinc-400 hover:border-teal-200 hover:text-teal-700"
                  >
                    + Add first page
                  </button>
                ) : (
                  rootDocs.map((doc) => (
                    <DocumentTreeNode
                      key={doc.id}
                      doc={doc}
                      depth={0}
                      childrenByParent={childrenByParent}
                      activeDocId={activeDocId}
                      expandedIds={expandedIds}
                      canDelete={documents.length > 1}
                      onToggleExpand={toggleExpand}
                      onSelectDoc={onSelectDoc}
                      onCreateChild={(sid, pid) => onCreateDoc(sid, pid)}
                      onDeleteDoc={onDeleteDoc}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
