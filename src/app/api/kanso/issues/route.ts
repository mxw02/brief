import { NextResponse, type NextRequest } from "next/server";
import type { KansoIssueSummary } from "@/lib/kanso";

const ISSUE_ID_RE = /^[A-Z][A-Z0-9]{1,9}-\d+$/;

function getKansoBaseUrl(): string {
  return (
    process.env.KANSO_API_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:3000"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kansoUrl = getKansoBaseUrl();

  const headers: Record<string, string> = {};
  const token = process.env.KANSO_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const searchQuery = searchParams.get("q");
  if (searchQuery !== null) {
    const q = searchQuery.trim().toLowerCase();
    try {
      const res = await fetch(`${kansoUrl}/api/issues`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return NextResponse.json({ kansoUrl, issues: [], unreachable: true });
      }
      const raw = (await res.json()) as Array<{
        identifier?: string;
        title?: string;
        status?: string;
        priority?: string;
        assigneeName?: string | null;
        assigneeType?: string | null;
      }>;
      const list = Array.isArray(raw) ? raw : [];
      const filtered = (
        q
          ? list.filter((item) => {
              const id = (item.identifier || "").toLowerCase();
              const title = (item.title || "").toLowerCase();
              return id.includes(q) || title.includes(q);
            })
          : list
      ).slice(0, 50);

      const issues: KansoIssueSummary[] = filtered
        .filter((item) => Boolean(item.identifier))
        .map((item) => {
          const identifier = (item.identifier || "").toUpperCase();
          const projectKey = identifier.split("-")[0];
          return {
            identifier,
            title: item.title || identifier,
            status: item.status || "TODO",
            priority: item.priority || "MEDIUM",
            assigneeName: item.assigneeName ?? null,
            assigneeType: item.assigneeType ?? null,
            url: `${kansoUrl}/projects/${projectKey}/issues/${identifier}`,
            found: true,
          };
        });

      return NextResponse.json({ kansoUrl, issues });
    } catch {
      return NextResponse.json({ kansoUrl, issues: [], unreachable: true });
    }
  }

  const rawIds = searchParams.get("ids") || "";
  const ids = Array.from(
    new Set(
      rawIds
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ISSUE_ID_RE.test(s))
    )
  ).slice(0, 20);

  if (ids.length === 0) {
    return NextResponse.json({ kansoUrl, issues: [] });
  }

  const issues: KansoIssueSummary[] = await Promise.all(
    ids.map(async (identifier) => {
      const projectKey = identifier.split("-")[0];
      const issueUrl = `${kansoUrl}/projects/${projectKey}/issues/${identifier}`;
      try {
        const res = await fetch(
          `${kansoUrl}/api/issues/${encodeURIComponent(identifier)}`,
          {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
          }
        );
        if (!res.ok) {
          return {
            identifier,
            title: "Ticket not found in Kanso",
            status: "BACKLOG",
            priority: "MEDIUM",
            assigneeName: null,
            assigneeType: null,
            url: issueUrl,
            found: false,
          };
        }
        const data = (await res.json()) as {
          identifier?: string;
          title?: string;
          status?: string;
          priority?: string;
          assigneeName?: string | null;
          assigneeType?: string | null;
        };
        return {
          identifier: data.identifier || identifier,
          title: data.title || identifier,
          status: data.status || "TODO",
          priority: data.priority || "MEDIUM",
          assigneeName: data.assigneeName ?? null,
          assigneeType: data.assigneeType ?? null,
          url: issueUrl,
          found: true,
        };
      } catch {
        return {
          identifier,
          title: "Kanso unreachable",
          status: "BACKLOG",
          priority: "MEDIUM",
          assigneeName: null,
          assigneeType: null,
          url: issueUrl,
          found: false,
        };
      }
    })
  );

  return NextResponse.json({ kansoUrl, issues });
}
