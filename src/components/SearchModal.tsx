"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search, Zap } from "lucide-react";
import {
  searchDocuments,
  type SearchIndexedDoc,
} from "@/lib/search-index";
import type { Space } from "@/lib/workspace";

interface SearchModalProps {
  open: boolean;
  index: SearchIndexedDoc[];
  spaces: Space[];
  onClose: () => void;
  onSelectDoc: (docId: string) => void;
}

function HighlightedText({
  text,
  terms,
}: {
  text: string;
  terms: string[];
}) {
  if (!text || terms.length === 0) return <>{text}</>;

  const escaped = terms
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return <>{text}</>;

  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some(
          (t) => part.toLowerCase() === t.toLowerCase()
        );
        return isMatch ? (
          <mark
            key={i}
            className="rounded bg-teal-100 px-0.5 font-medium text-teal-900"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export function SearchModal({
  open,
  index,
  spaces,
  onClose,
  onSelectDoc,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, durationMs } = useMemo(
    () => searchDocuments(index, query, selectedSpaceId),
    [index, query, selectedSpaceId]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedSpaceId(null);
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex >= results.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, results.length]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length === 0 ? 0 : (prev + 1) % results.length
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        results.length === 0
          ? 0
          : (prev - 1 + results.length) % results.length
      );
      return;
    }
    if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      onSelectDoc(results[activeIndex].doc.id);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/25 px-4 pt-[12vh] backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Instant Full-Text Search"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 py-3">
          <Search className="h-4 w-4 text-teal-700" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search all spaces and documents..."
            className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-800">
            <Zap className="h-2.5 w-2.5" />
            {durationMs < 0.1 ? "<0.1" : durationMs.toFixed(1)} ms
          </span>
          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            ESC
          </kbd>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2">
          <button
            type="button"
            onClick={() => {
              setSelectedSpaceId(null);
              setActiveIndex(0);
            }}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
              selectedSpaceId === null
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
            }`}
          >
            All Spaces
          </button>
          {spaces.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => {
                setSelectedSpaceId(space.id);
                setActiveIndex(0);
              }}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                selectedSpaceId === space.id
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {space.name}
            </button>
          ))}
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-zinc-400">
              No documents matched &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((result, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={result.doc.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    onSelectDoc(result.doc.id);
                    onClose();
                  }}
                  className={`flex w-full flex-col rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                    isActive
                      ? "bg-teal-50 text-teal-900"
                      : "text-zinc-700 hover:bg-zinc-100/70"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isActive ? "text-teal-700" : "text-zinc-400"
                        }`}
                      />
                      <span className="truncate text-sm font-semibold">
                        <HighlightedText
                          text={result.doc.title || "Untitled"}
                          terms={result.matchedTerms}
                        />
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        isActive
                          ? "border-teal-200 bg-white text-teal-700"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500"
                      }`}
                    >
                      {result.spaceName}
                    </span>
                  </div>
                  {result.snippet && (
                    <p
                      className={`mt-1 line-clamp-2 pl-5 text-xs leading-relaxed ${
                        isActive ? "text-teal-800/80" : "text-zinc-500"
                      }`}
                    >
                      <HighlightedText
                        text={result.snippet}
                        terms={result.matchedTerms}
                      />
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
