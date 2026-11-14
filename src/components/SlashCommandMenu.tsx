"use client";

import type { SlashCommand } from "@/lib/slash-commands";

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  activeIndex: number;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
}

export function SlashCommandMenu({
  commands,
  activeIndex,
  position,
  onSelect,
  onHover,
}: SlashCommandMenuProps) {
  if (commands.length === 0) {
    return (
      <div
        style={{ top: position.top, left: position.left }}
        className="absolute z-40 w-72 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-400 shadow-lg"
      >
        No matching commands
      </div>
    );
  }

  return (
    <div
      style={{ top: position.top, left: position.left }}
      className="absolute z-40 max-h-72 w-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg"
      role="listbox"
      aria-label="Slash commands"
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Insert Block
      </div>
      {commands.map((cmd, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={cmd.id}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(cmd);
            }}
            onMouseEnter={() => onHover(index)}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
              isActive
                ? "bg-teal-50 text-teal-800"
                : "text-zinc-700 hover:bg-zinc-100/70"
            }`}
          >
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold">{cmd.label}</div>
              <div
                className={`truncate text-[11px] ${
                  isActive ? "text-teal-700/80" : "text-zinc-500"
                }`}
              >
                {cmd.description}
              </div>
            </div>
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                isActive
                  ? "border-teal-200 bg-white text-teal-700"
                  : "border-zinc-200 bg-zinc-50 text-zinc-400"
              }`}
            >
              {cmd.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
}
