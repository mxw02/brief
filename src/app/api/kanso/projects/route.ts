import { NextResponse } from "next/server";

function getKansoBaseUrl(): string {
  return (
    process.env.KANSO_API_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:3000"
  );
}

export interface KansoProjectOption {
  id: string;
  key: string;
  name: string;
}

export async function GET() {
  const kansoUrl = getKansoBaseUrl();
  const headers: Record<string, string> = {};
  const token = process.env.KANSO_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${kansoUrl}/api/projects`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return NextResponse.json({ kansoUrl, projects: [], unreachable: true });
    }
    const raw = (await res.json()) as Array<{
      id?: string;
      key?: string;
      name?: string;
    }>;
    const projects: KansoProjectOption[] = (Array.isArray(raw) ? raw : [])
      .filter((p) => Boolean(p.id && p.key && p.name))
      .map((p) => ({
        id: String(p.id),
        key: String(p.key),
        name: String(p.name),
      }));

    return NextResponse.json({ kansoUrl, projects });
  } catch {
    return NextResponse.json({ kansoUrl, projects: [], unreachable: true });
  }
}
