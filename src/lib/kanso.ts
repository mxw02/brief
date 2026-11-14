export interface KansoIssueSummary {
  identifier: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string | null;
  assigneeType: string | null;
  url: string;
  found: boolean;
}

const HASH_TICKET_RE = /(?:^|[\s(])#([A-Z][A-Z0-9]{1,9}-\d+)\b/g;
const URL_TICKET_RE = /https?:\/\/[^\s)]+(?:\/issues\/|[?&]issue=)([A-Z][A-Z0-9]{1,9}-\d+)\b/g;

export function extractKansoTicketRefs(markdown: string): string[] {
  const found = new Set<string>();

  for (const match of markdown.matchAll(HASH_TICKET_RE)) {
    if (match[1]) found.add(match[1].toUpperCase());
  }
  for (const match of markdown.matchAll(URL_TICKET_RE)) {
    if (match[1]) found.add(match[1].toUpperCase());
  }

  return Array.from(found);
}

export const KANSO_STATUS_META: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  BACKLOG: {
    label: "Backlog",
    badgeClass: "border-zinc-200 bg-zinc-50 text-zinc-600",
    dotClass: "bg-zinc-400",
  },
  TODO: {
    label: "To Do",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    dotClass: "bg-amber-500",
  },
  IN_REVIEW: {
    label: "In Review",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-800",
    dotClass: "bg-violet-500",
  },
  REVIEW: {
    label: "In Review",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-800",
    dotClass: "bg-violet-500",
  },
  DONE: {
    label: "Done",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-600",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "border-zinc-200 bg-zinc-100 text-zinc-500",
    dotClass: "bg-zinc-400",
  },
};
