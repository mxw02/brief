"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  HardDrive,
  KeyRound,
  Layers,
  LogOut,
  RotateCcw,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import {
  DEFAULT_DOCUMENTS,
  DEFAULT_SPACES,
  type PublicUser,
  type Space,
} from "@/lib/workspace";
import { AgentMcpPanel } from "./AgentMcpPanel";
import { TeamAccessPanel } from "./TeamAccessPanel";

type SettingsSection = "account" | "team" | "tokens" | "workspace";

interface EinstellungPageClientProps {
  initialUser: PublicUser | null;
  spaces: Space[];
  documentCount: number;
}

export function EinstellungPageClient({
  initialUser,
  spaces,
  documentCount,
}: EinstellungPageClientProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(initialUser);
  const isAdmin = currentUser?.role === "admin";
  const canManageTokens =
    currentUser?.role === "admin" || currentUser?.role === "editor";

  const [section, setSection] = useState<SettingsSection>(
    isAdmin ? "team" : "account"
  );
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handleResetWorkspace() {
    if (
      !window.confirm(
        "Workspace wirklich auf den initialen Brief-Standard zurücksetzen? Alle selbst angelegten Spaces und Seiten werden überschrieben."
      )
    ) {
      return;
    }
    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaces: DEFAULT_SPACES,
          documents: DEFAULT_DOCUMENTS,
        }),
      });
      if (res.ok) {
        setResetMessage("Workspace auf Standard zurückgesetzt.");
      } else {
        setResetMessage("Zurücksetzen fehlgeschlagen.");
      }
    } finally {
      setResetting(false);
    }
  }

  const navItems: Array<{
    id: SettingsSection;
    label: string;
    icon: typeof User;
    visible: boolean;
  }> = [
    { id: "account", label: "Mein Konto", icon: User, visible: true },
    { id: "team", label: "Team & Rechte", icon: Users, visible: isAdmin },
    {
      id: "tokens",
      label: "API & MCP Tokens",
      icon: KeyRound,
      visible: canManageTokens,
    },
    { id: "workspace", label: "Workspace", icon: Layers, visible: true },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zu Brief
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Settings className="h-4 w-4" />
              </div>
              <h1 className="text-sm font-semibold text-zinc-900">
                Einstellungen
              </h1>
            </div>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                {currentUser.name}{" "}
                <span className="ml-1 rounded bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-700">
                  {currentUser.role}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <LogOut className="h-3.5 w-3.5" />
                Abmelden
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!currentUser ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-2xs">
            <Shield className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
            <h2 className="text-base font-semibold text-zinc-900">
              Anmeldung erforderlich
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Bitte melde dich zuerst in Brief an, um die Einstellungen zu öffnen.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
            >
              Zur Anmeldung
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <aside className="space-y-1">
              {navItems
                .filter((item) => item.visible)
                .map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                        active
                          ? "bg-teal-50 text-teal-800"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              {isAdmin && (
                <Link
                  href="/settings"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <HardDrive className="h-4 w-4 shrink-0" />
                  Backups &amp; Strategie
                </Link>
              )}
            </aside>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
              {section === "account" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Mein Konto
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Aktuelle Sitzungs- und Berechtigungsdetails.
                    </p>
                  </div>

                  <dl className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        Name
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                        {currentUser.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        E-Mail
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-700">
                        {currentUser.email}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        Rolle
                      </dt>
                      <dd className="mt-0.5 text-xs font-semibold uppercase text-teal-800">
                        {currentUser.role}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        Space-Zugriff
                      </dt>
                      <dd className="mt-0.5 text-xs text-zinc-700">
                        {currentUser.role === "admin" || currentUser.allSpaces
                          ? "Alle Spaces"
                          : `${currentUser.spaceIds.length} zugewiesene(r) Space(s)`}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {section === "team" && isAdmin && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Team, Rollen &amp; Space-Zugriff
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Mitarbeiter verwalten, Rollen festlegen und die
                      Agent-Bot-Policy steuern.
                    </p>
                  </div>
                  <TeamAccessPanel
                    active={section === "team"}
                    currentUser={currentUser}
                    spaces={spaces}
                    onUserUpdated={(updated) => setCurrentUser(updated)}
                  />
                </div>
              )}

              {section === "tokens" && canManageTokens && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Agent MCP Server &amp; Read/Write API
                    </h2>
                    <p className="text-xs text-zinc-500">
                      API-Tokens erzeugen, MCP-Clients verbinden und
                      REST-Endpunkte einsehen.
                    </p>
                  </div>
                  <AgentMcpPanel active={section === "tokens"} />
                </div>
              )}

              {section === "workspace" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Workspace &amp; Tastenkürzel
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Überblick über Spaces, Dokumente und Editor-Shortcuts.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        Sichtbare Spaces
                      </div>
                      <div className="mt-1 text-2xl font-bold text-zinc-900">
                        {spaces.length}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        Dokumente
                      </div>
                      <div className="mt-1 text-2xl font-bold text-zinc-900">
                        {documentCount}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-zinc-200 p-4 text-xs text-zinc-600">
                    <div className="font-semibold text-zinc-800">
                      Tastenkürzel im Editor
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <span>
                        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px]">
                          ⌘P
                        </kbd>{" "}
                        Schnellsuche
                      </span>
                      <span>
                        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px]">
                          ⌘K
                        </kbd>{" "}
                        Command Palette
                      </span>
                      <span>
                        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px]">
                          ⌘\
                        </kbd>{" "}
                        Focus Mode
                      </span>
                      <span>
                        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px]">
                          /
                        </kbd>{" "}
                        Slash Commands
                      </span>
                      <span>
                        <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px]">
                          [[
                        </kbd>{" "}
                        Wiki-Links
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                      <div>
                        <div className="text-xs font-semibold text-rose-900">
                          Demo-Workspace zurücksetzen
                        </div>
                        <p className="text-[11px] text-rose-800/80">
                          Stellt den initialen Brief-Space und die 5
                          Einstiegsseiten wieder her.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={resetting}
                        onClick={handleResetWorkspace}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100/70 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Zurücksetzen
                      </button>
                    </div>
                  )}

                  {resetMessage && (
                    <p className="text-xs font-medium text-teal-700">
                      {resetMessage}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
