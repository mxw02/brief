import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type { UserRole } from "./workspace";

export interface OidcConfig {
  providerName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  defaultRole: UserRole;
}

export interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
}

export const OIDC_STATE_COOKIE = "brief_oidc_state";

let cachedDiscovery: {
  issuerUrl: string;
  data: OidcDiscovery;
  expiresAt: number;
} | null = null;

export function getOidcConfig(): OidcConfig | null {
  const issuerUrl = process.env.OIDC_ISSUER_URL?.trim().replace(/\/+$/, "");
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim();
  if (!issuerUrl || !clientId || !clientSecret) {
    return null;
  }

  const rawRole = process.env.OIDC_DEFAULT_ROLE?.trim().toLowerCase();
  const defaultRole: UserRole =
    rawRole === "editor" || rawRole === "admin" ? rawRole : "viewer";

  return {
    providerName: process.env.OIDC_PROVIDER_NAME?.trim() || "SSO (OIDC)",
    issuerUrl,
    clientId,
    clientSecret,
    scopes: process.env.OIDC_SCOPES?.trim() || "openid profile email",
    defaultRole,
  };
}

export function getOidcPublicInfo(): {
  enabled: boolean;
  providerName: string;
} {
  const cfg = getOidcConfig();
  return {
    enabled: Boolean(cfg),
    providerName: cfg?.providerName ?? "Keycloak",
  };
}

export function getAppBaseUrl(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function fetchOidcDiscovery(
  issuerUrl: string
): Promise<OidcDiscovery> {
  const now = Date.now();
  if (
    cachedDiscovery &&
    cachedDiscovery.issuerUrl === issuerUrl &&
    cachedDiscovery.expiresAt > now
  ) {
    return cachedDiscovery.data;
  }

  const res = await fetch(`${issuerUrl}/.well-known/openid-configuration`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed with ${res.status}`);
  }
  const data = (await res.json()) as Partial<OidcDiscovery>;
  if (!data.authorization_endpoint || !data.token_endpoint) {
    throw new Error("Invalid OIDC discovery document");
  }

  const discovery: OidcDiscovery = {
    authorization_endpoint: data.authorization_endpoint,
    token_endpoint: data.token_endpoint,
    userinfo_endpoint: data.userinfo_endpoint,
  };
  cachedDiscovery = {
    issuerUrl,
    data: discovery,
    expiresAt: now + 10 * 60 * 1000,
  };
  return discovery;
}

export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function decodeJwtPayload(
  jwt: string
): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    return JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}
