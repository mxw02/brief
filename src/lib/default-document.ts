export const DEFAULT_DOCUMENT_TITLE = "Brief Architecture & Editor Spec";

export const DEFAULT_DOCUMENT_CONTENT = `# Brief — Distraction-Free Documentation

Welcome to **Brief**, an open-source, self-hosted alternative to Confluence.
Type \`/\` on any line for **Slash Commands**, or press \`Cmd+K\` (\`Ctrl+K\`) to open the **Command Palette**.

## Why Markdown-First?

- [x] Zero-latency typing without heavy WYSIWYG toolbars
- [x] Native syntax highlighting for code blocks
- [x] Built-in Mermaid diagram rendering
- [ ] Spaces & bidirectional \`[[Wiki Links]]\` *(BRIE-2)*

> **Tip:** Press \`Cmd+\\\` (or click **Focus**) to hide chrome and write in pure Zen mode.

## Code Example (Syntax Highlighting)

\`\`\`typescript
export interface BriefDocument {
  id: string;
  space: string;
  title: string;
  status: "Draft" | "In Review" | "Approved" | "Outdated";
  content: string;
}

export function estimateReadingTime(markdown: string): number {
  const words = markdown.trim().split(/\\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
\`\`\`

## System Flow (Mermaid)

\`\`\`mermaid
flowchart LR
  Author[Human / Agent] -->|Markdown + /commands| Editor[Brief Editor]
  Editor -->|Sync| DB[(PostgreSQL / SQLite)]
  Editor -->|Export| Context[Copy as Agent Context]
  Editor -->|Link| Kanso[Kanso Board BRIE]
\`\`\`

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| \`/\` | Open Slash Commands |
| \`Cmd/Ctrl + K\` | Open Command Palette |
| \`Cmd/Ctrl + B\` | Bold selection |
| \`Cmd/Ctrl + I\` | Italic selection |
| \`Cmd/Ctrl + E\` | Inline code |
| \`Cmd/Ctrl + \\\` | Toggle Focus Mode |
`;
