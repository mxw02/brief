export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  shortcut: string;
  keywords: string[];
  snippet: string;
  cursorOffset?: number;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    shortcut: "/h1",
    keywords: ["heading", "h1", "title"],
    snippet: "# ",
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    shortcut: "/h2",
    keywords: ["heading", "h2", "subtitle"],
    snippet: "## ",
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small subsection heading",
    shortcut: "/h3",
    keywords: ["heading", "h3"],
    snippet: "### ",
  },
  {
    id: "bullet",
    label: "Bullet List",
    description: "Unordered list item",
    shortcut: "/list",
    keywords: ["bullet", "list", "ul"],
    snippet: "- ",
  },
  {
    id: "numbered",
    label: "Numbered List",
    description: "Ordered list item",
    shortcut: "/ol",
    keywords: ["numbered", "ordered", "ol", "list"],
    snippet: "1. ",
  },
  {
    id: "todo",
    label: "Task Checklist",
    description: "Interactive markdown checkbox",
    shortcut: "/todo",
    keywords: ["todo", "task", "checkbox", "check"],
    snippet: "- [ ] ",
  },
  {
    id: "quote",
    label: "Blockquote",
    description: "Highlight a quote or note",
    shortcut: "/quote",
    keywords: ["quote", "blockquote", "note"],
    snippet: "> ",
  },
  {
    id: "callout",
    label: "Callout",
    description: "Highlighted info block",
    shortcut: "/callout",
    keywords: ["callout", "info", "alert", "tip"],
    snippet: "> **Note:** ",
  },
  {
    id: "code",
    label: "Code Block",
    description: "Fenced code with syntax highlighting",
    shortcut: "/code",
    keywords: ["code", "snippet", "ts", "pre"],
    snippet: "```typescript\n\n```",
    cursorOffset: -4,
  },
  {
    id: "mermaid",
    label: "Mermaid Diagram",
    description: "Flowchart or sequence diagram",
    shortcut: "/mermaid",
    keywords: ["mermaid", "diagram", "chart", "flow"],
    snippet:
      "```mermaid\nflowchart LR\n  A[Draft] --> B[In Review]\n  B --> C[Approved]\n```",
  },
  {
    id: "table",
    label: "Table",
    description: "Markdown data table",
    shortcut: "/table",
    keywords: ["table", "grid", "columns"],
    snippet:
      "| Column 1 | Column 2 | Status |\n| --- | --- | --- |\n| Item A | Details | Ready |",
  },
  {
    id: "hr",
    label: "Divider",
    description: "Horizontal rule separator",
    shortcut: "/hr",
    keywords: ["divider", "hr", "line", "separator"],
    snippet: "---\n",
  },
];
