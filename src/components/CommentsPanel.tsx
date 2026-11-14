"use client";

import { useState } from "react";
import {
  CheckCircle2,
  LocateFixed,
  MessageSquare,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { InlineComment } from "@/lib/workspace";

interface CommentsPanelProps {
  comments: InlineComment[];
  onToggleResolve: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onJumpToQuote?: (comment: InlineComment) => void;
}

export function CommentsPanel({
  comments,
  onToggleResolve,
  onDeleteComment,
  onJumpToQuote,
}: CommentsPanelProps) {
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  const visible = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  return (
    <section
      id="brief-comments-panel"
      className="mt-8 border-t border-zinc-200/80 pt-6"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <MessageSquare className="h-3.5 w-3.5 text-teal-700" />
          <span>Inline Comments</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
            {openCount} open
          </span>
        </div>

        <div className="flex items-center gap-1">
          {(
            [
              { id: "open", label: `Open (${openCount})` },
              { id: "resolved", label: `Resolved (${resolvedCount})` },
              { id: "all", label: `All (${comments.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                filter === tab.id
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-4 text-xs text-zinc-400">
          {comments.length === 0
            ? "Select any text in the document above and click Comment to add a minimalist inline note."
            : filter === "open"
              ? "All inline comments are resolved."
              : "No resolved comments yet."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {visible.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl border p-3.5 transition-colors ${
                comment.resolved
                  ? "border-zinc-200/70 bg-zinc-50/70 opacity-75"
                  : "border-zinc-200 bg-white"
              }`}
            >
              {comment.quote && (
                <button
                  type="button"
                  onClick={() => onJumpToQuote?.(comment)}
                  className="group mb-2 flex w-full items-center justify-between gap-2 rounded-r-md border-l-2 border-teal-600/60 bg-teal-50/30 py-1 pl-2.5 pr-2 text-left text-xs italic text-zinc-600 transition-colors hover:border-teal-700 hover:bg-teal-50 hover:text-teal-900"
                  title="Jump to highlighted text in document"
                >
                  <span className="line-clamp-2">&ldquo;{comment.quote}&rdquo;</span>
                  <LocateFixed className="h-3 w-3 shrink-0 text-teal-700 opacity-60 transition-opacity group-hover:opacity-100" />
                </button>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-800">{comment.body}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="font-medium text-zinc-500">
                      {comment.author}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleResolve(comment.id)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      comment.resolved
                        ? "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {comment.resolved ? (
                      <>
                        <RotateCcw className="h-3 w-3" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Resolve
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteComment(comment.id)}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
