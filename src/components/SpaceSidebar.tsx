"use client";

import { useState } from "react";
import { FileText, FolderPlus, Hash, Plus, Trash2 } from "lucide-react";
import type { BriefDocument, Space } from "@/lib/workspace";

interface SpaceSidebarProps {
  spaces: Space[];
  documents: BriefDocument[];
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: (spaceId: string) => void;
  onDeleteDoc: (docId: string) => void;
  onCreateSpace: (name: string) => void;
}

export function SpaceSidebar({
  spaces,
  documents,
  activeDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onCreateSpace,
}: SpaceSidebarProps) {
  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");

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
                <button
                  type="button"
                  onClick={() => onCreateDoc(space.id)}
                  className="rounded p-0.5 text-zinc-400 opacity-75 transition-colors hover:bg-white hover:text-teal-700 group-hover:opacity-100"
                  title={`New page in ${space.name}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-0.5">
                {spaceDocs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onCreateDoc(space.id)}
                    className="w-full rounded-lg border border-dashed border-zinc-200 px-2.5 py-1.5 text-left text-[11px] text-zinc-400 hover:border-teal-200 hover:text-teal-700"
                  >
                    + Add first page
                  </button>
                ) : (
                  spaceDocs.map((doc) => {
                    const isActive = doc.id === activeDocId;
                    return (
                      <div
                        key={doc.id}
                        className={`group flex items-center justify-between rounded-lg border px-2 py-1.5 transition-colors ${
                          isActive
                            ? "border-teal-200 bg-teal-50 text-teal-800"
                            : "border-transparent text-zinc-600 hover:bg-white hover:text-zinc-900"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectDoc(doc.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <FileText
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isActive ? "text-teal-700" : "text-zinc-400"
                            }`}
                          />
                          <span className="truncate text-xs font-medium">
                            {doc.title || "Untitled"}
                          </span>
                        </button>
                        {documents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteDoc(doc.id)}
                            className="ml-1 hidden rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 group-hover:inline-flex"
                            title="Delete page"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
