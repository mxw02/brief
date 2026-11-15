"use client";

import { useEffect } from "react";
import { Bot, X } from "lucide-react";
import { AgentMcpPanel } from "./AgentMcpPanel";

interface AgentMcpModalProps {
  open: boolean;
  onClose: () => void;
}

export function AgentMcpModal({ open, onClose }: AgentMcpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Agent MCP Server &amp; Read/Write API
              </h2>
              <p className="text-xs text-zinc-500">
                Claude Code, Cursor oder Workflows verbinden. Agent-Schreibzugriffe
                erstellen standardmäßig Drafts zur Prüfung.
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

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <AgentMcpPanel active={open} />
        </div>
      </div>
    </div>
  );
}
