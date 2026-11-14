import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, hashPassword } from "@/lib/auth";
import {
  dbCreateUser,
  dbFindUserByEmail,
  dbGetAgentBotDraftOnly,
  dbListUsers,
  dbSetAgentBotDraftOnly,
} from "@/lib/db";
import type { UserRole } from "@/lib/workspace";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, agentBotDraftOnly] = await Promise.all([
    dbListUsers(),
    dbGetAgentBotDraftOnly(),
  ]);
  return NextResponse.json({ users, agentBotDraftOnly });
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    allSpaces?: boolean;
    spaceIds?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!name || !email || password.length < 6) {
    return NextResponse.json(
      {
        error:
          "Name, E-Mail und Passwort (mindestens 6 Zeichen) sind erforderlich",
      },
      { status: 400 }
    );
  }

  const existing = await dbFindUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "E-Mail-Adresse existiert bereits" },
      { status: 409 }
    );
  }

  const role: UserRole =
    body.role === "admin" || body.role === "editor" || body.role === "viewer"
      ? body.role
      : "editor";

  const user = await dbCreateUser({
    id: `user-${crypto.randomUUID()}`,
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    allSpaces: role === "admin" ? true : Boolean(body.allSpaces),
    spaceIds: Array.isArray(body.spaceIds) ? body.spaceIds : [],
  });

  return NextResponse.json({ user }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { agentBotDraftOnly?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.agentBotDraftOnly === "boolean") {
    await dbSetAgentBotDraftOnly(body.agentBotDraftOnly);
  }
  const agentBotDraftOnly = await dbGetAgentBotDraftOnly();
  return NextResponse.json({ agentBotDraftOnly });
}
