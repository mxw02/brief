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

export type UserRole = "admin" | "editor" | "viewer" | "agent_bot";
export type AuthorType = "human" | "agent";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allSpaces: boolean;
  spaceIds: string[];
  createdAt: string;
}

export interface InlineComment {
  id: string;
  quote: string;
  from?: number;
  to?: number;
  body: string;
  author: string;
  authorType?: AuthorType;
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
  lastEditedBy?: string | null;
  lastEditedByType?: AuthorType | null;
  comments?: InlineComment[];
}

export interface Backlink {
  sourceDoc: BriefDocument;
  sourceSpace: Space | undefined;
  snippet: string;
}

export const DEFAULT_SPACES: Space[] = [
  { id: "space-brief", name: "Brief", slug: "brief" },
];

export const DEFAULT_DOCUMENTS: BriefDocument[] = [
  {
    id: "doc-welcome",
    spaceId: "space-brief",
    parentId: null,
    title: "Welcome to Brief",
    updatedAt: "2026-11-15T10:00:00.000Z",
    content: `# Welcome to Brief

**Brief** is an open-source, self-hosted knowledge base built for clarity, speed, and seamless collaboration between humans and AI agents.

## What You Can Do Here

- **Write without friction:** Use the distraction-free Markdown editor with \`/\` **Slash Commands**, code syntax highlighting, checklists, and **Mermaid** diagrams.
- **Connect knowledge:** Link pages with \`[[Wiki-Links]]\` and explore automatic **Backlinks** instead of getting lost in deep folder trees.
- **Find anything instantly:** Press \`Cmd+K\` (or \`Ctrl+K\`) to search across all pages and spaces.
- **Collaborate safely:** Manage **Spaces**, **Roles**, **Draft Proposals**, and **SSO (OIDC)** from the top bar.
- **Work with AI Agents:** Export any page as **Agent Context** in one click, or connect external agents via **MCP** and the **REST API**.

## Guides in This Space

- [[Editor, Wiki-Links & Search]] — Formatting, \`/\` commands, \`[[\` links, and keyboard shortcuts
- [[Spaces, Permissions & SSO]] — Roles, space access, draft proposals, and OIDC login
- [[AI Agents, MCP & REST API]] — Agent context export, API tokens, and \`/api/mcp\`
- [[Self-Hosting & Configuration]] — Docker Compose, \`scripts/init.sh\`, and environment variables

## How Brief Works

\`\`\`mermaid
flowchart LR
  Author[Human / AI Agent] -->|Markdown & Wiki-Links| Editor[Brief Editor]
  Editor -->|Publish or Propose| DB[(PostgreSQL / SQLite)]
  Editor -->|1-Click Export / MCP| Agent[AI Workflows]
\`\`\`
`,
  },
  {
    id: "doc-editor",
    spaceId: "space-brief",
    parentId: "doc-welcome",
    title: "Editor, Wiki-Links & Search",
    updatedAt: "2026-11-15T10:00:00.000Z",
    content: `# Editor, Wiki-Links & Search

Brief combines a fast, clean writing experience with structured linking and instant search.

## Slash Commands & Formatting

Type \`/\` on a new line in the editor to insert:

- Headings, bullet lists, numbered lists, and task checklists
- Fenced code blocks with syntax highlighting
- Mermaid flowcharts, sequence diagrams, and state diagrams
- Quotes, tables, and page templates

\`\`\`typescript
// Example: Brief document structure
export interface BriefDocument {
  id: string;
  spaceId: string;
  title: string;
  content: string;
}
\`\`\`

## Bidirectional Wiki-Links

Type \`[[\` anywhere in a document to link to another page by title, such as [[Welcome to Brief]] or [[AI Agents, MCP & REST API]].

- Brief automatically tracks **Backlinks** at the bottom of every target page so you can always see which documents reference it.
- You can also nest pages under a parent page in the sidebar for lightweight hierarchy.

## Instant Search & Command Palette

- Press \`Cmd+K\` (macOS) or \`Ctrl+K\` (Windows/Linux) to jump to any page, switch spaces, or run quick actions.
- Full-text search indexes titles, content, and space names.
`,
  },
  {
    id: "doc-permissions",
    spaceId: "space-brief",
    parentId: "doc-welcome",
    title: "Spaces, Permissions & SSO",
    updatedAt: "2026-11-15T10:00:00.000Z",
    content: `# Spaces, Permissions & SSO

Organize your knowledge into focused **Spaces** and control who can view, edit, or publish.

## Roles & Space Access

Open **Team & Permissions** in the header (available to Admins) to manage users:

- **Admin:** Full access to all spaces, user management, API tokens, and workspace settings.
- **Editor:** Can create, edit, and publish pages in assigned spaces.
- **Viewer:** Read-only access to assigned spaces (and can submit draft proposals if enabled).

You can grant a user access to **All Spaces** or restrict them to specific spaces.

## Drafts & Change Proposals

- Pages support **Published** and **Draft / Proposal** states so edits can be reviewed before going live.
- Admins can enable **Draft-only mode for AI agents** so agent edits always arrive as proposals.

## Single Sign-On (OIDC / SSO)

Configure any OpenID Connect provider (such as Keycloak, Authentik, or Okta) via \`OIDC_*\` environment variables.

- Users signing in via SSO are automatically matched or created in Brief by email.
- New SSO users start as **Viewer** and can be granted roles and space permissions in **Team & Permissions** just like regular accounts.
`,
  },
  {
    id: "doc-agents",
    spaceId: "space-brief",
    parentId: "doc-welcome",
    title: "AI Agents, MCP & REST API",
    updatedAt: "2026-11-15T10:00:00.000Z",
    content: `# AI Agents, MCP & REST API

Brief is built from the ground up to serve as shared memory for both your team and your AI agents.

## 1-Click Agent Context Export

Click **Copy as Agent Context** on any page to copy clean Markdown bundled with its nested child pages and \`[[Wiki-Linked]]\` references — ready to paste into an LLM prompt.

## API Tokens & MCP Server

Open **Agent MCP & API** in the header to generate scoped API tokens (or set \`BRIEF_API_TOKEN\` in your environment).

- **MCP Endpoint:** \`POST /api/mcp\` (Model Context Protocol for listing spaces, searching, reading, and creating/updating docs)
- **REST API:**
  - \`GET /api/v1/spaces\` — List accessible spaces
  - \`GET /api/v1/documents\` — List or filter documents
  - \`GET /api/v1/search?q=...\` — Full-text search
  - \`POST /api/v1/documents\` / \`PATCH /api/v1/documents/:id\` — Create or update pages

See [[Spaces, Permissions & SSO]] for details on restricting agent edits to draft proposals.
`,
  },
  {
    id: "doc-selfhosting",
    spaceId: "space-brief",
    parentId: "doc-welcome",
    title: "Self-Hosting & Configuration",
    updatedAt: "2026-11-15T10:00:00.000Z",
    content: `# Self-Hosting & Configuration

Brief runs anywhere via Docker Compose with PostgreSQL 16 (or single-container SQLite).

## Quick Start with Docker Compose

\`\`\`bash
./scripts/init.sh --up
\`\`\`

\`scripts/init.sh\` creates \`.env\` from \`.env.example\` and automatically generates secure random values for \`AUTH_SECRET\`, \`POSTGRES_PASSWORD\`, and \`DATABASE_URL\`.

## Key Environment Variables

- \`APP_URL\` — Public URL of your Brief instance (used for auth redirects and links)
- \`PORT\` — Host port mapped to container port \`3000\` (default: \`3000\`)
- \`POSTGRES_PORT\` — Host port mapped to PostgreSQL \`5432\` (default: \`5432\`)
- \`BRIEF_VERSION\` — Docker image tag (e.g. \`latest\`, \`develop\`, or a release tag)
- \`OIDC_PROVIDER_NAME\`, \`OIDC_ISSUER_URL\`, \`OIDC_CLIENT_ID\`, \`OIDC_CLIENT_SECRET\` — Optional SSO configuration

For a complete overview of features, return to [[Welcome to Brief]].
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
