import { NextResponse, type NextRequest } from "next/server";
import type { KansoIssueSummary } from "@/lib/kanso";

const ISSUE_ID_RE = /^[A-Z][A-Z0-9]{1,9}-\d+$/;

function getKansoBaseUrl(): string {
  return (
    process.env.KANSO_API_URL?.trim().replace(/\/+$/, "") ||
    "http://192.168.178.45:3000"
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawIds = searchParams.get("ids") || "";
  const ids = Array.from(
    new Set(
      rawIds
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ISSUE_ID_RE.test(s))
    )
  ).slice(0, 20);

  const kansoUrl = getKansoBaseUrl();
  if (ids.length === 0) {
    return NextResponse.json({ kansoUrl, issues: [] });
  }

  const headers: Record<string, string> = {};
  const token = process.env.KANSO_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
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
