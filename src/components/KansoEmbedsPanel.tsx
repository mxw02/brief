"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, KanbanSquare, RefreshCw, User } from "lucide-react";
import {
  extractKansoTicketRefs,
  KANSO_STATUS_META,
  type KansoIssueSummary,
} from "@/lib/kanso";

interface KansoEmbedsPanelProps {
  content: string;
}

export function KansoEmbedsPanel({ content }: KansoEmbedsPanelProps) {
  const refs = useMemo(() => extractKansoTicketRefs(content), [content]);
  const refsKey = refs.join(",");

  const [issues, setIssues] = useState<KansoIssueSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchIssues = useCallback(async (idsKey: string) => {
    abortRef.current?.abort();

    if (!idsKey) {
      setIssues([]);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/kanso/issues?ids=${encodeURIComponent(idsKey)}`,
        { signal: controller.signal }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { issues?: KansoIssueSummary[] };
      if (seq === requestSeqRef.current && Array.isArray(data.issues)) {
        setIssues(data.issues);
      }
    } catch {
      // Ignore aborts and transient network failures
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!refsKey) {
      fetchIssues("");
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchIssues(refsKey);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [refsKey, fetchIssues]);

  const issuesById = useMemo(() => {
    const map = new Map<string, KansoIssueSummary>();
    for (const issue of issues) {
      map.set(issue.identifier.toUpperCase(), issue);
    }
    return map;
  }, [issues]);

  const displayedIssues = useMemo(
    () =>
      refs.map(
        (id) =>
          issuesById.get(id) ?? {
            identifier: id,
            title: "Loading...",
            status: "TODO",
            priority: "MEDIUM",
            assigneeName: null,
            assigneeType: null,
            url: "#",
            found: false,
          }
      ),
    [refs, issuesById]
  );

  if (refs.length === 0) return null;

  return (
    <section className="mt-8 border-t border-zinc-200/80 pt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <KanbanSquare className="h-3.5 w-3.5 text-teal-700" />
          <span>Kanso Live Tickets ({refs.length})</span>
        </div>
        <button
          type="button"
          onClick={() => fetchIssues(refsKey)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50"
          title="Refresh live ticket status"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {displayedIssues.map((issue) => {
          const statusMeta =
            KANSO_STATUS_META[issue.status] ?? KANSO_STATUS_META.BACKLOG;
          return (
            <a
              key={issue.identifier}
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-left transition-colors hover:border-teal-200 hover:bg-teal-50/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-teal-800">
                  {issue.identifier}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusMeta.badgeClass}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                    />
                    {statusMeta.label}
                  </span>
                  <ExternalLink className="h-3 w-3 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>

              <div className="mt-1.5 line-clamp-1 text-sm font-medium text-zinc-900">
                {issue.title}
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3 text-zinc-400" />
                  {issue.assigneeName || "Unassigned"}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                  {issue.priority}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
