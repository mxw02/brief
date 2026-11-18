"use client";

import { useState } from "react";
import { KeyRound, Users, X } from "lucide-react";
import type { PublicUser, Space } from "@/lib/workspace";
import { AgentMcpPanel } from "./AgentMcpPanel";
import { TeamAccessPanel } from "./TeamAccessPanel";

interface TeamAccessModalProps {
  open: boolean;
  currentUser: PublicUser;
  spaces: Space[];
  onClose: () => void;
  onUserUpdated: (updated: PublicUser) => void;
}

export function TeamAccessModal({
  open,
  currentUser,
  spaces,
  onClose,
  onUserUpdated,
}: TeamAccessModalProps) {
  const [activeTab, setActiveTab] = useState<"team" | "tokens">("team");

  if (!open) return null;

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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "tokens" ? (
            <AgentMcpPanel active={open && activeTab === "tokens"} />
          ) : (
            <TeamAccessPanel
              active={open && activeTab === "team"}
              currentUser={currentUser}
              spaces={spaces}
              onUserUpdated={onUserUpdated}
            />
          )}
        </div>
      </div>
    </div>
  );
}
