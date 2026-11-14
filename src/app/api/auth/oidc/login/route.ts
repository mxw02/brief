import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  fetchOidcDiscovery,
  generatePkcePair,
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

  try {
    const discovery = await fetchOidcDiscovery(cfg.issuerUrl);
    const state = crypto.randomBytes(16).toString("base64url");
    const nonce = crypto.randomBytes(16).toString("base64url");
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const redirectUri = `${baseUrl}/api/auth/oidc/callback`;

    const authUrl = new URL(discovery.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", cfg.scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set(
      OIDC_STATE_COOKIE,
      JSON.stringify({ state, nonce, codeVerifier }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
        secure: baseUrl.startsWith("https://"),
      }
    );
    return response;
  } catch {
    return NextResponse.redirect(`${baseUrl}/?auth_error=oidc_discovery_failed`);
  }
}
