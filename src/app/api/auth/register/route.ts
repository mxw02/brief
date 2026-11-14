import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  hashPassword,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSessionToken,
} from "@/lib/auth";
import {
  dbCountUsers,
  dbCreateUser,
  dbFindUserByEmail,
} from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; password?: string };
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
          "Name, E-Mail und ein Passwort (mindestens 6 Zeichen) sind erforderlich",
      },
      { status: 400 }
    );
  }

  const existing = await dbFindUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "Diese E-Mail-Adresse ist bereits registriert" },
      { status: 409 }
    );
  }

  const userCount = await dbCountUsers();
  const isFirstAdmin = userCount === 0;

  const user = await dbCreateUser({
    id: `user-${crypto.randomUUID()}`,
    name,
    email,
    passwordHash: hashPassword(password),
    role: isFirstAdmin ? "admin" : "viewer",
    allSpaces: isFirstAdmin,
    spaceIds: [],
  });

  const response = NextResponse.json({ user }, { status: 201 });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    signSessionToken(user.id),
    sessionCookieOptions()
  );
  return response;
}
