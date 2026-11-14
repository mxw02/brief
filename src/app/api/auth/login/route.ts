import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { dbFindUserByEmail } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "E-Mail und Passwort erforderlich" },
      { status: 400 }
    );
  }

  const found = await dbFindUserByEmail(email);
  if (!found || !verifyPassword(password, found.passwordHash)) {
    return NextResponse.json(
      { error: "Ungültige Anmeldedaten" },
      { status: 401 }
    );
  }

  const { passwordHash: _ignored, ...publicUser } = found;
  void _ignored;
  const response = NextResponse.json({ user: publicUser });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    signSessionToken(publicUser.id),
    sessionCookieOptions()
  );
  return response;
}
