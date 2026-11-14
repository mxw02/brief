import { NextResponse, type NextRequest } from "next/server";
import { createApiToken, listApiTokens } from "@/lib/server-store";

export async function GET() {
  const tokens = await listApiTokens();
  return NextResponse.json({
    tokens,
    envTokenConfigured: Boolean(process.env.BRIEF_API_TOKEN?.trim()),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const created = await createApiToken(body.name || "Agent Token");
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create API token" },
      { status: 400 }
    );
  }
}
