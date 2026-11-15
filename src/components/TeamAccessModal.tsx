"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, KeyRound, Plus, Shield, Trash2, Users, X } from "lucide-react";
import type { PublicUser, Space, UserRole } from "@/lib/workspace";
import { AgentMcpPanel } from "./AgentMcpPanel";

interface TeamAccessModalProps {
  open: boolean;
  currentUser: PublicUser;
  spaces: Space[];
  onClose: () => void;
  onUserUpdated: (updated: PublicUser) => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export function TeamAccessModal({
  open,
  currentUser,
  spaces,
  onClose,
  onUserUpdated,
}: TeamAccessModalProps) {
  const [activeTab, setActiveTab] = useState<"team" | "tokens">("team");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [agentBotDraftOnly, setAgentBotDraftOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("editor");
  const [newAllSpaces, setNewAllSpaces] = useState(false);
  const [newSpaceIds, setNewSpaceIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        setError("Benutzerliste konnte nicht geladen werden");
        return;
      }
      const data = (await res.json()) as {
        users?: PublicUser[];
        agentBotDraftOnly?: boolean;
      };
      if (Array.isArray(data.users)) {
        setUsers(data.users);
      }
      if (typeof data.agentBotDraftOnly === "boolean") {
        setAgentBotDraftOnly(data.agentBotDraftOnly);
      }
    } catch {
      setError("Server nicht erreichbar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadUsers();
    }
  }, [open, loadUsers]);

  if (!open) return null;

  async function handleUpdateUser(
    userId: string,
    patch: { role?: UserRole; allSpaces?: boolean; spaceIds?: string[] }
  ) {
    setError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        user?: PublicUser;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setError(data.error || "Aktualisierung fehlgeschlagen");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? data.user! : u))
      );
      if (userId === currentUser.id) {
        onUserUpdated(data.user);
      }
    } catch {
      setError("Server nicht erreichbar");
    }
  }

  async function handleDeleteUser(userId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Löschen fehlgeschlagen");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setError("Server nicht erreichbar");
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          allSpaces: newRole === "admin" ? true : newAllSpaces,
          spaceIds: newSpaceIds,
        }),
      });
      const data = (await res.json()) as {
        user?: PublicUser;
        error?: string;
      };
      if (!res.ok || !data.user) {
        setError(data.error || "Mitarbeiter konnte nicht angelegt werden");
        setCreating(false);
        return;
      }
      setUsers((prev) => [...prev, data.user!]);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("editor");
      setNewAllSpaces(false);
      setNewSpaceIds([]);
      setShowAddForm(false);
    } catch {
      setError("Server nicht erreichbar");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleAgentDraftOnly(next: boolean) {
    setAgentBotDraftOnly(next);
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentBotDraftOnly: next }),
      });
    } catch {
      // Ignore transient error
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/35 px-4 py-6 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Team, Rollen &amp; Space-Zugriff
              </h2>
              <p className="text-xs text-zinc-500">
                Mitarbeiter verwalten und festlegen, wer auf welche Spaces
                zugreifen darf.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50/60 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "team"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Team &amp; Rechte
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tokens")}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "tokens"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            API &amp; MCP Tokens
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {activeTab === "tokens" ? (
            <AgentMcpPanel active={open && activeTab === "tokens"} />
          ) : (
            <>
              {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Agent-Bot Policy */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <div className="text-xs font-semibold text-emerald-900">
                  Agent-Bot Policy (MCP &amp; REST API)
                </div>
                <p className="text-[11px] text-emerald-800/80">
                  Standardmäßig darf der Agent-Bot nur{" "}
                  <code className="font-mono font-semibold">Draft</code>
                  -Vorschläge erstellen und keine bestehenden Docs direkt
                  überschreiben.
                </p>
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-emerald-900">
              <input
                type="checkbox"
                checked={agentBotDraftOnly}
                onChange={(e) => handleToggleAgentDraftOnly(e.target.checked)}
                className="h-4 w-4 rounded border-emerald-300 accent-emerald-700"
              />
              Nur Drafts
            </label>
          </div>

          {/* Add Employee */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Mitarbeiter ({users.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Mitarbeiter anlegen
            </button>
          </div>

          {showAddForm && (
            <form
              onSubmit={handleCreateUser}
              className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-teal-700 focus:outline-none"
                />
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="E-Mail"
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-teal-700 focus:outline-none"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Passwort (min. 6 Zeichen)"
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <span className="font-medium">Rolle:</span>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                {newRole !== "admin" && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={newAllSpaces}
                      onChange={(e) => setNewAllSpaces(e.target.checked)}
                      className="accent-teal-700"
                    />
                    Alle Spaces
                  </label>
                )}
              </div>

              {newRole !== "admin" && !newAllSpaces && (
                <div className="flex flex-wrap gap-2">
                  {spaces.map((space) => {
                    const checked = newSpaceIds.includes(space.id);
                    return (
                      <label
                        key={space.id}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                          checked
                            ? "border-teal-300 bg-teal-50 text-teal-800"
                            : "border-zinc-200 bg-white text-zinc-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setNewSpaceIds((prev) =>
                              e.target.checked
                                ? [...prev, space.id]
                                : prev.filter((id) => id !== space.id)
                            )
                          }
                          className="accent-teal-700"
                        />
                        # {space.name}
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-200/60"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </form>
          )}

          {/* User List */}
          {loading ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              Lade Mitarbeiter...
            </div>
          ) : (
            <div className="space-y-2.5">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                const isAdmin = u.role === "admin";
                return (
                  <div
                    key={u.id}
                    className="rounded-xl border border-zinc-200 bg-white p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900">
                            {u.name}
                          </span>
                          {isSelf && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                              Du
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">{u.email}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            void handleUpdateUser(u.id, {
                              role: e.target.value as UserRole,
                            })
                          }
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800 disabled:opacity-60"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>

                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteUser(u.id)}
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Mitarbeiter entfernen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-zinc-100 pt-2.5">
                      {isAdmin ? (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700">
                          <Shield className="h-3.5 w-3.5" />
                          Admin hat automatisch Zugriff auf alle Spaces
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-zinc-500">
                              Space-Zugriff
                            </span>
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                              <input
                                type="checkbox"
                                checked={u.allSpaces}
                                onChange={(e) =>
                                  void handleUpdateUser(u.id, {
                                    allSpaces: e.target.checked,
                                  })
                                }
                                className="accent-teal-700"
                              />
                              Alle Spaces freigeben
                            </label>
                          </div>

                          {!u.allSpaces && (
                            <div className="flex flex-wrap gap-1.5">
                              {spaces.map((space) => {
                                const hasAccess = u.spaceIds.includes(space.id);
                                return (
                                  <label
                                    key={space.id}
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                                      hasAccess
                                        ? "border-teal-300 bg-teal-50 text-teal-800"
                                        : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-800"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={hasAccess}
                                      onChange={(e) => {
                                        const nextIds = e.target.checked
                                          ? [...u.spaceIds, space.id]
                                          : u.spaceIds.filter(
                                              (id) => id !== space.id
                                            );
                                        void handleUpdateUser(u.id, {
                                          spaceIds: nextIds,
                                        });
                                      }}
                                      className="accent-teal-700"
                                    />
                                    # {space.name}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
