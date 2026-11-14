"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

export interface PaletteAction {
  id: string;
  group: "Navigate" | "View" | "Insert" | "Template" | "Document";
  label: string;
  description: string;
  shortcut?: string;
  onRun: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}

export function CommandPalette({
  open,
  onClose,
  actions,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filtered.length]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0 ? 0 : (prev + 1) % filtered.length
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0
          ? 0
          : (prev - 1 + filtered.length) % filtered.length
      );
      return;
    }
    if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      filtered[activeIndex].onRun();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/25 px-4 pt-[14vh] backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 py-3">
          <Search className="h-4 w-4 text-teal-700" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search actions..."
            className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-zinc-400">
              No matching commands for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((action, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={action.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    action.onRun();
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-teal-50 text-teal-900"
                      : "text-zinc-700 hover:bg-zinc-100/70"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                        isActive
                          ? "border-teal-200 bg-white text-teal-700"
                          : "border-zinc-200 bg-zinc-100/70 text-zinc-500"
                      }`}
                    >
                      {action.group}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {action.label}
                      </div>
                      <div
                        className={`truncate text-xs ${
                          isActive ? "text-teal-700/80" : "text-zinc-500"
                        }`}
                      >
                        {action.description}
                      </div>
                    </div>
                  </div>
                  {action.shortcut && (
                    <kbd className="ml-3 shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
