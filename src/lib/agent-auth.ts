import { NextResponse, type NextRequest } from "next/server";
import { verifyApiToken } from "./server-store";

export type AgentAuthResult =
  | { ok: true; agentName: string }
  | { ok: false; response: NextResponse };

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match?.[1]) return match[1].trim();
  }
  const alt = request.headers.get("x-brief-token");
  return alt?.trim() || null;
}

export async function requireAgentAuth(
  request: NextRequest
): Promise<AgentAuthResult> {
  const token = extractBearerToken(request);
  const check = await verifyApiToken(token);
  if (!check.valid) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Unauthorized",
          message:
            "Provide a valid API token via Authorization: Bearer <token> or x-brief-token header.",
        },
        { status: 401 }
      ),
    };
  }
  return { ok: true, agentName: check.agentName || "Agent" };
}
