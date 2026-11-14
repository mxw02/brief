export type SlashCommandCategory = "block" | "template";

export interface SlashCommand {
  id: string;
  category: SlashCommandCategory;
  label: string;
  description: string;
  shortcut: string;
  keywords: string[];
  snippet: string;
  cursorOffset?: number;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Blocks
  {
    id: "h1",
    category: "block",
    label: "Heading 1",
    description: "Large section heading",
    shortcut: "/h1",
    keywords: ["heading", "h1", "title", "headline"],
    snippet: "# ",
  },
  {
    id: "h2",
    category: "block",
    label: "Heading 2",
    description: "Medium section heading",
    shortcut: "/h2",
    keywords: ["heading", "h2", "subtitle", "headline"],
    snippet: "## ",
  },
  {
    id: "h3",
    category: "block",
    label: "Heading 3",
    description: "Small subsection heading",
    shortcut: "/h3",
    keywords: ["heading", "h3", "headline"],
    snippet: "### ",
  },
  {
    id: "bullet",
    category: "block",
    label: "Bullet List",
    description: "Unordered list item",
    shortcut: "/list",
    keywords: ["bullet", "list", "ul"],
    snippet: "- ",
  },
  {
    id: "numbered",
    category: "block",
    label: "Numbered List",
    description: "Ordered list item",
    shortcut: "/ol",
    keywords: ["numbered", "ordered", "ol", "list"],
    snippet: "1. ",
  },
  {
    id: "todo",
    category: "block",
    label: "Task Checklist",
    description: "Interactive markdown checkbox",
    shortcut: "/todo",
    keywords: ["todo", "task", "checkbox", "check"],
    snippet: "- [ ] ",
  },
  {
    id: "quote",
    category: "block",
    label: "Blockquote",
    description: "Highlight a quote or note",
    shortcut: "/quote",
    keywords: ["quote", "blockquote", "note"],
    snippet: "> ",
  },
  {
    id: "callout",
    category: "block",
    label: "Callout",
    description: "Highlighted info block",
    shortcut: "/callout",
    keywords: ["callout", "info", "alert", "tip"],
    snippet: "> **Note:** ",
  },
  {
    id: "code",
    category: "block",
    label: "Code Block",
    description: "Fenced code with syntax highlighting",
    shortcut: "/code",
    keywords: ["code", "snippet", "ts", "pre"],
    snippet: "```typescript\n\n```",
    cursorOffset: -4,
  },
  {
    id: "mermaid",
    category: "block",
    label: "Mermaid Diagram",
    description: "Flowchart or sequence diagram",
    shortcut: "/mermaid",
    keywords: ["mermaid", "diagram", "chart", "flow"],
    snippet:
      "```mermaid\nflowchart LR\n  A[Draft] --> B[In Review]\n  B --> C[Approved]\n```",
  },
  {
    id: "table",
    category: "block",
    label: "Table",
    description: "Markdown data table",
    shortcut: "/table",
    keywords: ["table", "grid", "columns"],
    snippet:
      "| Column 1 | Column 2 | Status |\n| --- | --- | --- |\n| Item A | Details | Ready |",
  },
  {
    id: "hr",
    category: "block",
    label: "Divider",
    description: "Horizontal rule separator",
    shortcut: "/hr",
    keywords: ["divider", "hr", "line", "separator"],
    snippet: "---\n",
  },

  // Reusable Templates
  {
    id: "tpl-section",
    category: "template",
    label: "Section (Headline + Text)",
    description: "Clean H2 heading with body paragraph",
    shortcut: "/section",
    keywords: ["template", "section", "headline", "text", "paragraph"],
    snippet: "## Section Title\n\nWrite your key points here.\n",
  },
  {
    id: "tpl-meeting",
    category: "template",
    label: "Meeting Notes",
    description: "Date, attendees, agenda, decisions & action items",
    shortcut: "/meeting",
    keywords: ["template", "meeting", "notes", "agenda", "action"],
    snippet: `## Meeting Notes — YYYY-MM-DD

**Attendees:** @name

### Agenda
- Topic 1
- Topic 2

### Decisions
- Decision summary

### Action Items
- [ ] Follow-up task (@owner)
`,
  },
  {
    id: "tpl-adr",
    category: "template",
    label: "Architecture Decision (ADR)",
    description: "Status, context, decision & consequences",
    shortcut: "/adr",
    keywords: ["template", "adr", "architecture", "decision", "rfc"],
    snippet: `## ADR-001: Title

**Status:** Proposed

### Context
What problem or constraint are we addressing?

### Decision
What approach did we choose and why?

### Consequences
- **Pros:** Fast, simple, maintainable
- **Trade-offs:** Any limitations or follow-up work
`,
  },
  {
    id: "tpl-spec",
    category: "template",
    label: "Feature Spec",
    description: "Overview, goals, design & acceptance criteria",
    shortcut: "/spec",
    keywords: ["template", "spec", "feature", "prd", "design"],
    snippet: `## Feature Spec: Name

### Overview
Short summary of the feature and user value.

### Goals & Non-Goals
- **Goal:** ...
- **Non-Goal:** ...

### Technical Design
\`\`\`mermaid
flowchart LR
  Client --> API --> DB[(Database)]
\`\`\`

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
`,
  },
  {
    id: "tpl-runbook",
    category: "template",
    label: "Runbook / Incident",
    description: "Severity, symptoms, mitigation & follow-ups",
    shortcut: "/runbook",
    keywords: ["template", "runbook", "incident", "ops", "debug"],
    snippet: `## Runbook: Service / Issue

**Severity:** Medium | **Owner:** @team

### Symptoms
How does the issue surface?

### Mitigation Steps
1. Check health endpoint (\`/api/health\`)
2. Inspect recent logs

### Follow-ups
- [ ] Root cause fix
`,
  },
  {
    id: "tpl-changelog",
    category: "template",
    label: "Changelog Entry",
    description: "Added, changed & fixed release notes",
    shortcut: "/changelog",
    keywords: ["template", "changelog", "release", "notes"],
    snippet: `## v0.x.0 — YYYY-MM-DD

### Added
- New capability

### Changed
- Improved behavior

### Fixed
- Resolved issue
`,
  },
];
