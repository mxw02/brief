"use client";

import { KanbanSquare, Loader2 } from "lucide-react";
import { KANSO_STATUS_META, type KansoIssueSummary } from "@/lib/kanso";

interface KansoTicketMenuProps {
  query: string;
  issues: KansoIssueSummary[];
  loading: boolean;
  unreachable: boolean;
  activeIndex: number;
  position: { top: number; left: number };
  onSelectTicket: (issue: KansoIssueSummary) => void;
  onHover: (index: number) => void;
}

export function KansoTicketMenu({
  query,
  issues,
  loading,
  unreachable,
  activeIndex,
  position,
  onSelectTicket,
  onHover,
}: KansoTicketMenuProps) {
  return (
    <div
      style={{ top: position.top, left: position.left }}
      className="absolute z-40 max-h-72 w-96 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg"
      role="listbox"
      aria-label="Kanso ticket suggestions"
    >
      <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <KanbanSquare className="h-3 w-3 text-teal-700" />
          Kanso Tickets {query ? `(#${query})` : "(#)"}
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-teal-700" />}
      </div>

      {issues.map((issue, index) => {
        const isActive = index === activeIndex;
        const statusMeta =
          KANSO_STATUS_META[issue.status] ?? KANSO_STATUS_META.BACKLOG;
        return (
          <button
            key={issue.identifier}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectTicket(issue);
            }}
            onMouseEnter={() => onHover(index)}
            className={`flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
              isActive
                ? "bg-teal-50 text-teal-900"
                : "text-zinc-700 hover:bg-zinc-100/70"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-teal-800">
                {issue.identifier}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${statusMeta.badgeClass}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                />
                {statusMeta.label}
              </span>
            </div>
            <span className="truncate text-xs font-medium text-zinc-800">
              {issue.title}
            </span>
          </button>
        );
      })}

      {issues.length === 0 && !loading && (
        <div className="px-2.5 py-2 text-xs text-zinc-400">
          {unreachable
            ? "Kanso nicht erreichbar"
            : "Keine passenden Kanso-Tickets gefunden"}
        </div>
      )}
    </div>
  );
}
