"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Tags, X } from "lucide-react";
import type { FrontmatterMetadata } from "@/lib/frontmatter";

interface FrontmatterBarProps {
  metadata: FrontmatterMetadata;
  onChange: (next: FrontmatterMetadata) => void;
}

const SUGGESTED_KEYS = ["tech-stack", "owner", "scope", "repo"] as const;

export function FrontmatterBar({ metadata, onChange }: FrontmatterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [newKey, setNewKey] = useState("tech-stack");
  const [newValue, setNewValue] = useState("");

  const entries = Object.entries(metadata).filter(([, v]) =>
    Array.isArray(v) ? v.length > 0 : v.trim().length > 0
  );

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    const k = newKey.trim().toLowerCase().replace(/\s+/g, "-");
    const v = newValue.trim();
    if (!k || !v) return;

    const parsedValue = v.includes(",")
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : v;

    onChange({ ...metadata, [k]: parsedValue });
    setNewValue("");
  };

  const handleRemoveKey = (key: string) => {
    const next = { ...metadata };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="mb-4 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-white hover:text-zinc-900"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Tags className="h-3 w-3 text-teal-700" />
            <span>Metadata</span>
          </button>

          {entries.length === 0 ? (
            <span className="text-[11px] text-zinc-400">
              No YAML frontmatter (tech-stack, owner, scope…)
            </span>
          ) : (
            entries.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700"
              >
                <span className="font-mono text-[10px] text-zinc-400">
                  {key}:
                </span>
                <span className="font-medium text-zinc-800">
                  {Array.isArray(value) ? value.join(", ") : value}
                </span>
                {expanded && (
                  <button
                    type="button"
                    onClick={() => handleRemoveKey(key)}
                    className="ml-0.5 rounded text-zinc-400 hover:text-red-600"
                    title={`Remove ${key}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-teal-700 hover:bg-teal-50"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {expanded && (
        <form
          onSubmit={handleAddField}
          className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-zinc-200/70 pt-2.5"
        >
          <select
            value={
              SUGGESTED_KEYS.includes(newKey as (typeof SUGGESTED_KEYS)[number])
                ? newKey
                : "custom"
            }
            onChange={(e) => {
              if (e.target.value !== "custom") setNewKey(e.target.value);
            }}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-teal-700 focus:outline-none"
          >
            {SUGGESTED_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
            <option value="custom">custom key</option>
          </select>

          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="key"
            className="w-28 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs text-zinc-800 focus:border-teal-700 focus:outline-none"
          />

          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value (comma-separated for list, e.g. nextjs, postgres)"
            className="min-w-[200px] flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-teal-700 focus:outline-none"
          />

          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-800"
          >
            <Plus className="h-3 w-3" />
            Save
          </button>
        </form>
      )}
    </div>
  );
}
