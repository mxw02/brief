export interface Space {
  id: string;
  name: string;
  slug: string;
}

export type DocumentStatus =
  | "draft"
  | "ready_for_review"
  | "in_review"
  | "approved"
  | "outdated";

export const SPEC_STATUSES: DocumentStatus[] = [
  "draft",
  "ready_for_review",
  "in_review",
  "approved",
  "outdated",
];

export const SPEC_STATUS_META: Record<
  DocumentStatus,
  { label: string; shortLabel: string; badgeClass: string; dotClass: string }
> = {
  draft: {
    label: "Draft",
    shortLabel: "Draft",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    dotClass: "bg-amber-500",
  },
  ready_for_review: {
    label: "Ready for Review",
    shortLabel: "Ready",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-800",
    dotClass: "bg-violet-500",
  },
  in_review: {
    label: "In Review",
    shortLabel: "Review",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  },
  approved: {
    label: "Approved",
    shortLabel: "Approved",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-600",
  },
  outdated: {
    label: "Outdated",
    shortLabel: "Outdated",
    badgeClass: "border-zinc-300 bg-zinc-100 text-zinc-600",
    dotClass: "bg-zinc-400",
  },
};

export function normalizeDocumentStatus(
  status?: string | null
): DocumentStatus {
  if (status === "draft") return "draft";
  if (status === "ready_for_review") return "ready_for_review";
  if (status === "in_review") return "in_review";
  if (status === "outdated") return "outdated";
  return "approved";
}

export interface InlineComment {
  id: string;
  quote: string;
  from?: number;
  to?: number;
  body: string;
  author: string;
  resolved: boolean;
  createdAt: string;
}

export interface BriefDocument {
  id: string;
  spaceId: string;
  parentId: string | null;
  title: string;
  content: string;
  updatedAt: string;
  status?: DocumentStatus;
  proposedBy?: string;
  proposalTargetId?: string;
  proposalSummary?: string;
  comments?: InlineComment[];
}

export interface Backlink {
  sourceDoc: BriefDocument;
  sourceSpace: Space | undefined;
  snippet: string;
}

export const DEFAULT_SPACES: Space[] = [
  { id: "space-eng", name: "Engineering", slug: "engineering" },
  { id: "space-prod", name: "Product", slug: "product" },
  { id: "space-comp", name: "Company", slug: "company" },
];

export const DEFAULT_DOCUMENTS: BriefDocument[] = [
  {
    id: "doc-arch",
    spaceId: "space-eng",
    parentId: null,
    title: "Brief Architecture & Editor Spec",
    updatedAt: "2026-11-14T14:20:00.000Z",
    content: `# Brief — Distraction-Free Documentation

Welcome to **Brief**, an open-source, self-hosted alternative to Confluence.
Type \`/\` for **Slash Commands & Templates**, \`[[\` for **Wiki-Links**, or \`Cmd+K\` for the **Command Palette**.

## Connected Docs

- Deployment & storage details: [[Self-Hosting & Database Guide]]
- Upcoming milestones: [[Q4 Product Roadmap]]
- New to the team? Start with [[Team Onboarding]]

## Code Example (Syntax Highlighting)

\`\`\`typescript
export interface BriefDocument {
  id: string;
  spaceId: string;
  title: string;
  content: string;
}
\`\`\`

## System Flow (Mermaid)

\`\`\`mermaid
flowchart LR
  Author[Human / Agent] -->|Markdown & Links| Editor[Brief Editor]
  Editor -->|Sync| DB[(PostgreSQL / SQLite)]
  Editor -->|Link| Kanso[Kanso Board BRIE]
\`\`\`
`,
  },
  {
    id: "doc-selfhost",
    spaceId: "space-eng",
    parentId: "doc-arch",
    title: "Self-Hosting & Database Guide",
    updatedAt: "2026-11-14T14:15:00.000Z",
    content: `# Self-Hosting & Database Guide

Brief is designed to run anywhere in 30 seconds via Docker Compose.
See [[Brief Architecture & Editor Spec]] for the overall system flow.

## Stack

- **Runtime:** Node.js 22 (Next.js standalone)
- **Database:** PostgreSQL 16 (with SQLite zero-config option planned)

\`\`\`bash
cp .env.example .env
docker compose up -d
\`\`\`
`,
  },
  {
    id: "doc-roadmap",
    spaceId: "space-prod",
    parentId: null,
    title: "Q4 Product Roadmap",
    updatedAt: "2026-11-14T14:10:00.000Z",
    content: `# Q4 Product Roadmap

Key priorities tracked in Kanso (\`BRIE\`):

- [x] **BRIE-1:** Distraction-free Markdown Editor, \`/commands\`, \`Cmd+K\`, Mermaid
- [x] **BRIE-2:** Flat Spaces & Bidirectional \`[[Wiki-Links]]\`
- [ ] **BRIE-3:** Instant Full-Text Search (< 50ms)
- [ ] **BRIE-8:** Copy as Agent Context (1-Click Markdown Export)

Related specs: [[Brief Architecture & Editor Spec]] and [[Self-Hosting & Database Guide]].
`,
  },
  {
    id: "doc-onboarding",
    spaceId: "space-comp",
    parentId: null,
    title: "Team Onboarding",
    updatedAt: "2026-11-14T14:05:00.000Z",
    content: `# Team Onboarding

Welcome! Here is how we organize knowledge in Brief:

1. Keep hierarchy flat using **Spaces** (\`Engineering\`, \`Product\`, \`Company\`).
2. Connect related pages with \`[[Document Title]]\` instead of deep folders.
3. Review [[Q4 Product Roadmap]] and [[Brief Architecture & Editor Spec]] to get up to speed.
`,
  },
];

const WIKI_LINK_REGEX = /\[\[([^[\]\n]+?)\]\]/g;

function stripCodeBlocksAndInlineCode(markdown: string): string {
  // Remove fenced code blocks first, then inline code spans
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
}

export function extractWikiLinks(markdown: string): string[] {
  const cleaned = stripCodeBlocksAndInlineCode(markdown);
  const links = new Set<string>();
  for (const match of cleaned.matchAll(WIKI_LINK_REGEX)) {
    const target = match[1]?.trim();
    if (target) links.add(target);
  }
  return Array.from(links);
}

export function findBacklinks(
  targetDoc: BriefDocument,
  allDocs: BriefDocument[],
  spaces: Space[]
): Backlink[] {
  const normalizedTarget = targetDoc.title.trim().toLowerCase();
  if (!normalizedTarget) return [];

  const spaceMap = new Map(spaces.map((s) => [s.id, s]));
  const results: Backlink[] = [];

  for (const doc of allDocs) {
    if (doc.id === targetDoc.id) continue;
    const links = extractWikiLinks(doc.content);
    const hasLink = links.some((l) => l.toLowerCase() === normalizedTarget);
    if (!hasLink) continue;

    // Extract first matching line as snippet
    const lines = doc.content.split("\n");
    const matchingLine =
      lines.find((line) =>
        line.toLowerCase().includes(`[[${normalizedTarget}]]`)
      ) ?? "";

    results.push({
      sourceDoc: doc,
      sourceSpace: spaceMap.get(doc.spaceId),
      snippet: matchingLine.trim().slice(0, 140),
    });
  }

  return results;
}

export function getDocumentAncestors(
  docId: string,
  allDocs: BriefDocument[]
): BriefDocument[] {
  const byId = new Map(allDocs.map((d) => [d.id, d]));
  const chain: BriefDocument[] = [];
  const seen = new Set<string>();
  let current = byId.get(docId);

  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}

export const BRIEF_DOC_HREF_PREFIX = "#brief-doc:";

/**
 * Converts [[Document Title]] outside fenced code blocks and inline code
 * into safe Markdown links (#brief-doc:Document%20Title) for react-markdown.
 */
export function preprocessWikiLinks(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return segments
    .map((segment, index) => {
      // Odd indices are code blocks / inline code
      if (index % 2 === 1) return segment;
      return segment.replace(WIKI_LINK_REGEX, (_, rawTarget: string) => {
        const target = rawTarget.trim();
        if (!target) return _;
        return `[${target}](${BRIEF_DOC_HREF_PREFIX}${encodeURIComponent(target)})`;
      });
    })
    .join("");
}
