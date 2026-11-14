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
import {
  decodeJwtPayload,
  fetchOidcDiscovery,
  getAppBaseUrl,
  getOidcConfig,
  OIDC_STATE_COOKIE,
} from "@/lib/oidc";

export async function GET(request: NextRequest) {
  const cfg = getOidcConfig();
  const baseUrl = getAppBaseUrl(request);

  if (!cfg) {
    return NextResponse.redirect(`${baseUrl}/?auth_error=oidc_not_configured`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=${encodeURIComponent(oauthError)}`
    );
  }

  const rawCookie = request.cookies.get(OIDC_STATE_COOKIE)?.value;
  if (!code || !state || !rawCookie) {
    return NextResponse.redirect(`${baseUrl}/?auth_error=invalid_oidc_state`);
  }

  let saved: { state?: string; codeVerifier?: string };
  try {
    saved = JSON.parse(rawCookie) as typeof saved;
  } catch {
    return NextResponse.redirect(`${baseUrl}/?auth_error=invalid_oidc_state`);
  }

  if (saved.state !== state || !saved.codeVerifier) {
    return NextResponse.redirect(`${baseUrl}/?auth_error=invalid_oidc_state`);
  }

  try {
    const discovery = await fetchOidcDiscovery(cfg.issuerUrl);
    const redirectUri = `${baseUrl}/api/auth/oidc/callback`;

    const tokenRes = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code_verifier: saved.codeVerifier,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${baseUrl}/?auth_error=oidc_token_failed`);
    }

    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      id_token?: string;
    };

    let claims: Record<string, unknown> = tokens.id_token
      ? (decodeJwtPayload(tokens.id_token) ?? {})
      : {};

    if (discovery.userinfo_endpoint && tokens.access_token) {
      try {
        const userInfoRes = await fetch(discovery.userinfo_endpoint, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: AbortSignal.timeout(5000),
        });
        if (userInfoRes.ok) {
          const userInfo = (await userInfoRes.json()) as Record<
            string,
            unknown
          >;
          claims = { ...claims, ...userInfo };
        }
      } catch {
        // Fall back to id_token claims
      }
    }

    const emailRaw =
      typeof claims.email === "string"
        ? claims.email
        : typeof claims.preferred_username === "string" &&
            claims.preferred_username.includes("@")
          ? claims.preferred_username
          : "";

    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      return NextResponse.redirect(`${baseUrl}/?auth_error=oidc_missing_email`);
    }

    const displayName =
      (typeof claims.name === "string" && claims.name.trim()) ||
      (typeof claims.preferred_username === "string" &&
        claims.preferred_username.trim()) ||
      email.split("@")[0];

    let userId: string;
    const existing = await dbFindUserByEmail(email);
    if (existing) {
      userId = existing.id;
    } else {
      const userCount = await dbCountUsers();
      const isFirstAdmin = userCount === 0;
      const created = await dbCreateUser({
        id: `user-${crypto.randomUUID()}`,
        name: displayName,
        email,
        passwordHash: hashPassword(crypto.randomBytes(24).toString("hex")),
        role: isFirstAdmin ? "admin" : cfg.defaultRole,
        allSpaces: isFirstAdmin,
        spaceIds: [],
      });
      userId = created.id;
    }

    const response = NextResponse.redirect(`${baseUrl}/`);
    response.cookies.set(
      SESSION_COOKIE_NAME,
      signSessionToken(userId),
      sessionCookieOptions()
    );
    response.cookies.set(OIDC_STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.redirect(`${baseUrl}/?auth_error=oidc_callback_failed`);
  }
}
