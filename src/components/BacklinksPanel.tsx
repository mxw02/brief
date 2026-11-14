"use client";

import { ArrowUpRight, Link2 } from "lucide-react";
import type { Backlink } from "@/lib/workspace";

interface BacklinksPanelProps {
  backlinks: Backlink[];
  onNavigate: (docId: string) => void;
}

export function BacklinksPanel({ backlinks, onNavigate }: BacklinksPanelProps) {
  return (
    <div className="mt-8 border-t border-zinc-200 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-teal-700" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Backlinks ({backlinks.length})
        </h3>
      </div>

      {backlinks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/70 px-3.5 py-3 text-xs text-zinc-400">
          No other documents link here yet. Reference this page using{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-zinc-600">
            [[Page Title]]
          </code>
          .
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {backlinks.map(({ sourceDoc, sourceSpace, snippet }) => (
            <button
              key={sourceDoc.id}
              type="button"
              onClick={() => onNavigate(sourceDoc.id)}
              className="group flex flex-col items-start rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-left transition-colors hover:border-teal-200 hover:bg-teal-50/40"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-zinc-900 group-hover:text-teal-800">
                  {sourceDoc.title}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {sourceSpace && (
                    <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                      {sourceSpace.name}
                    </span>
                  )}
                  <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-teal-700" />
                </div>
              </div>
              {snippet && (
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                  {snippet}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
