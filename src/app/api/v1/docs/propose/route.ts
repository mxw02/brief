import { NextResponse, type NextRequest } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { proposeAgentDraft } from "@/lib/server-store";

export async function POST(request: NextRequest) {
  const auth = await requireAgentAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      title?: string;
      content?: string;
      spaceId?: string;
      targetDocId?: string;
      parentId?: string | null;
      proposedBy?: string;
      summary?: string;
    };

    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Missing required field: content (Markdown string)" },
        { status: 400 }
      );
    }

    const draft = await proposeAgentDraft({
      title: body.title || "",
      content: body.content,
      spaceId: body.spaceId,
      targetDocId: body.targetDocId,
      parentId: body.parentId,
      proposedBy: body.proposedBy || auth.agentName,
      summary: body.summary,
    });

    return NextResponse.json(
      {
        message:
          "Draft proposal created. Published documents remain unchanged until human review.",
        draft,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
}
