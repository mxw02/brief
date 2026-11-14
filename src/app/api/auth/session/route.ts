import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbCountUsers, dbGetAgentBotDraftOnly } from "@/lib/db";

export async function GET() {
  const [user, userCount, agentBotDraftOnly] = await Promise.all([
    getSessionUser(),
    dbCountUsers(),
    dbGetAgentBotDraftOnly(),
  ]);

  return NextResponse.json({
    user,
    needsSetup: userCount === 0,
    agentBotDraftOnly,
  });
}
