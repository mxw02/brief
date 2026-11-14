"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  KeyRound,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface PublicToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface AgentMcpModalProps {
  open: boolean;
  onClose: () => void;
}

export function AgentMcpModal({ open, onClose }: AgentMcpModalProps) {
  const [tokens, setTokens] = useState<PublicToken[]>([]);
  const [envTokenConfigured, setEnvTokenConfigured] = useState(false);
  const [tokenName, setTokenName] = useState("Claude Code");
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/tokens");
      if (!res.ok) return;
      const data = (await res.json()) as {
        tokens: PublicToken[];
        envTokenConfigured: boolean;
      };
      setTokens(data.tokens || []);
      setEnvTokenConfigured(Boolean(data.envTokenConfigured));
    } catch {
      // Ignore network errors in modal
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadTokens();
  }, [open, loadTokens]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3002";

  const mcpSnippet = JSON.stringify(
    {
      mcpServers: {
        brief: {
          url: `${origin}/api/mcp`,
          headers: {
            Authorization: `Bearer ${newlyCreatedToken || "<YOUR_BRIEF_API_TOKEN>"}`,
          },
        },
      },
    },
    null,
    2
  );

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tokenName }),
      });
      if (res.ok) {
        const data = (await res.json()) as { token: string };
        setNewlyCreatedToken(data.token);
        await loadTokens();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    await fetch(`/api/v1/tokens/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await loadTokens();
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

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
                Connect Claude Code, Cursor, or workflows. Agent writes always
                create Drafts for review.
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

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
          {/* API Token Generator */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <KeyRound className="h-3.5 w-3.5 text-teal-700" />
                API Tokens
              </h3>
              {envTokenConfigured && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  BRIEF_API_TOKEN active
                </span>
              )}
            </div>

            <form onSubmit={handleCreateToken} className="flex gap-2">
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Token label (e.g. Claude Code, Cursor, CI)"
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-teal-700 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate Token
              </button>
            </form>

            {newlyCreatedToken && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-800">
                    New Token (copy now — shown once):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("token", newlyCreatedToken)}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    {copiedKey === "token" ? (
                      <>
                        <Check className="h-3 w-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <code className="block break-all font-mono text-xs text-emerald-950">
                  {newlyCreatedToken}
                </code>
              </div>
            )}

            {tokens.length > 0 && (
              <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {tokens.map((tok) => (
                  <div
                    key={tok.id}
                    className="flex items-center justify-between px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium text-zinc-800">
                        {tok.name}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-zinc-400">
                        {tok.prefix}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeToken(tok.id)}
                      className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      title="Revoke token"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* MCP Client Config */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                MCP Server Configuration (Claude Code / Cursor)
              </h3>
              <button
                type="button"
                onClick={() => handleCopy("mcp", mcpSnippet)}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
              >
                {copiedKey === "mcp" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" /> Copied JSON
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Config
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-800">
              {mcpSnippet}
            </pre>
            <p className="text-[11px] text-zinc-500">
              MCP Tools: <code>search_docs</code>, <code>list_adrs</code>,{" "}
              <code>list_spaces</code>, <code>get_doc</code>,{" "}
              <code>propose_draft</code>, <code>list_drafts</code>
            </p>
          </section>

          {/* REST Read/Write API */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Read/Write REST API
            </h3>
            <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700">
              <div>
                <span className="font-semibold text-teal-700">GET</span>{" "}
                /api/v1/docs?q=adr&amp;type=adr
              </div>
              <div>
                <span className="font-semibold text-teal-700">GET</span>{" "}
                /api/v1/docs/:id?context=true
              </div>
              <div>
                <span className="font-semibold text-teal-700">GET</span>{" "}
                /api/v1/spaces
              </div>
              <div>
                <span className="font-semibold text-emerald-700">POST</span>{" "}
                /api/v1/docs/propose{" "}
                <span className="font-sans text-zinc-500">
                  (creates Draft, never overwrites published)
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
