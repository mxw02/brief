import { NextResponse, type NextRequest } from "next/server";
import { readWorkspaceStore, writeWorkspaceContent } from "@/lib/server-store";
import type { BriefDocument, Space } from "@/lib/workspace";

export async function GET() {
  const data = await readWorkspaceStore();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      spaces?: Space[];
      documents?: BriefDocument[];
    };
    if (!Array.isArray(body.spaces) || !Array.isArray(body.documents)) {
      return NextResponse.json(
        { error: "Invalid workspace payload" },
        { status: 400 }
      );
    }
    const saved = await writeWorkspaceContent(body.spaces, body.documents);
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json(
      { error: "Failed to persist workspace" },
      { status: 400 }
    );
  }
}
