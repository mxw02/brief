"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderPlus,
  Hash,
  Plus,
  Trash2,
} from "lucide-react";
import type { BriefDocument, Space } from "@/lib/workspace";

interface SpaceSidebarProps {
  spaces: Space[];
  documents: BriefDocument[];
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: (spaceId: string, parentId?: string | null) => void;
  onDeleteDoc: (docId: string) => void;
  onCreateSpace: (name: string) => void;
  onCopySpaceContext: (spaceId: string) => void;
  onOpenAgentMcp: () => void;
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
            {doc.status === "draft" && (
              <span className="ml-auto shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                Draft
              </span>
            )}
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

export function SpaceSidebar({
  spaces,
  documents,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onCreateSpace,
  onCopySpaceContext,
  onOpenAgentMcp,
}: SpaceSidebarProps) {
  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [copiedSpaceId, setCopiedSpaceId] = useState<string | null>(null);

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
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/70">
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
          const spaceDocs = documents.filter((d) => d.spaceId === space.id);
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

          const rootDocs = childrenByParent.get(null) ?? [];

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
                </div>
              </div>

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

      <div className="border-t border-zinc-200 p-3">
        <button
          type="button"
          onClick={onOpenAgentMcp}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
        >
          <span className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-emerald-700" />
            Agent MCP &amp; API
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-zinc-500">
            Tokens
          </span>
        </button>
      </div>
    </aside>
  );
}
