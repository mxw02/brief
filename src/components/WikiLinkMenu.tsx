"use client";

import { FileText, Plus } from "lucide-react";
import type { BriefDocument, Space } from "@/lib/workspace";

interface WikiLinkMenuProps {
  query: string;
  documents: BriefDocument[];
  spaces: Space[];
  activeIndex: number;
  position: { top: number; left: number };
  onSelectDoc: (docTitle: string) => void;
  onCreateAndLink: (title: string) => void;
  onHover: (index: number) => void;
}

export function WikiLinkMenu({
  query,
  documents,
  spaces,
  activeIndex,
  position,
  onSelectDoc,
  onCreateAndLink,
  onHover,
}: WikiLinkMenuProps) {
  const spaceMap = new Map(spaces.map((s) => [s.id, s]));
  const trimmedQuery = query.trim();
  const exactExists = documents.some(
    (d) => d.title.trim().toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCreateOption = Boolean(trimmedQuery) && !exactExists;

  return (
    <div
      style={{ top: position.top, left: position.left }}
      className="absolute z-40 max-h-72 w-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg"
      role="listbox"
      aria-label="Wiki link suggestions"
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Link Document ([[...]])
      </div>

      {documents.map((doc, index) => {
        const isActive = index === activeIndex;
        const space = spaceMap.get(doc.spaceId);
        return (
          <button
            key={doc.id}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectDoc(doc.title);
            }}
            onMouseEnter={() => onHover(index)}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
              isActive
                ? "bg-teal-50 text-teal-800"
                : "text-zinc-700 hover:bg-zinc-100/70"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2 pr-2">
              <FileText
                className={`h-3.5 w-3.5 shrink-0 ${
                  isActive ? "text-teal-700" : "text-zinc-400"
                }`}
              />
              <span className="truncate text-xs font-medium">{doc.title}</span>
            </div>
            {space && (
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  isActive
                    ? "border-teal-200 bg-white text-teal-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500"
                }`}
              >
                {space.name}
              </span>
            )}
          </button>
        );
      })}

      {showCreateOption && (
        <button
          type="button"
          role="option"
          aria-selected={activeIndex === documents.length}
          onMouseDown={(e) => {
            e.preventDefault();
            onCreateAndLink(trimmedQuery);
          }}
          onMouseEnter={() => onHover(documents.length)}
          className={`mt-1 flex w-full items-center gap-2 rounded-lg border-t border-zinc-100 px-2.5 py-2 text-left text-xs font-medium transition-colors ${
            activeIndex === documents.length
              ? "bg-teal-50 text-teal-800"
              : "text-teal-700 hover:bg-zinc-100/70"
          }`}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Create &amp; link &ldquo;{trimmedQuery}&rdquo;
          </span>
        </button>
      )}

      {documents.length === 0 && !showCreateOption && (
        <div className="px-2.5 py-3 text-xs text-zinc-400">
          No documents found
        </div>
      )}
    </div>
  );
}
