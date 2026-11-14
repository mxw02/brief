"use client";

import { useState } from "react";
import { Lock, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import type { PublicUser } from "@/lib/workspace";

interface AuthScreenProps {
  needsSetup: boolean;
  onAuthenticated: (user: PublicUser) => void;
}

export function AuthScreen({ needsSetup, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">(
    needsSetup ? "register" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const endpoint =
        mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register" ? { name, email, password } : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        user?: PublicUser;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setError(data.error || "Anmeldung fehlgeschlagen");
        setSubmitting(false);
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("Server nicht erreichbar");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9F9F8] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
            {needsSetup ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">
              {needsSetup ? "Brief Admin-Setup" : "Brief Workspace"}
            </h1>
            <p className="text-xs text-zinc-500">
              {needsSetup
                ? "Ersten Administrator-Account für dein Team einrichten"
                : "Melde dich an, um auf freigegebene Spaces zuzugreifen"}
            </p>
          </div>
        </div>

        {!needsSetup && (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-lg py-1.5 transition-colors ${
                mode === "login"
                  ? "bg-white text-zinc-900 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`rounded-lg py-1.5 transition-colors ${
                mode === "register"
                  ? "bg-white text-zinc-900 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Registrieren
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Max Mustermann"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-teal-700 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              E-Mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@unternehmen.de"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Passwort
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
          >
            {mode === "register" ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {needsSetup
              ? "Admin-Account erstellen"
              : mode === "register"
                ? "Konto erstellen"
                : "Anmelden"}
          </button>

          {mode === "register" && !needsSetup && (
            <p className="text-center text-[11px] text-zinc-400">
              Neue Konten starten als Viewer. Ein Admin weist anschließend Rolle
              und Spaces zu.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
