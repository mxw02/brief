import {
  extractWikiLinks,
  getDocumentAncestors,
  type BriefDocument,
  type Space,
} from "./workspace";

const TICKET_REGEX = /#([A-Z]{2,10}-\d+)\b/g;

export function extractTicketIdentifiers(markdown: string): string[] {
  const cleaned = markdown.replace(/```[\s\S]*?```/g, "");
  const ids = new Set<string>();
  for (const match of cleaned.matchAll(TICKET_REGEX)) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
}

export interface AgentContextOptions {
  sameSpaceOnly?: boolean;
}

export function buildAgentContextMarkdown(
  doc: BriefDocument,
  allDocs: BriefDocument[],
  spaces: Space[],
  options: AgentContextOptions = { sameSpaceOnly: true }
): string {
  const sameSpaceOnly = options.sameSpaceOnly ?? true;
  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
  const spaceName = spaceMap.get(doc.spaceId) ?? "Space";
  const ancestors = getDocumentAncestors(doc.id, allDocs);
  const breadcrumb = [
    spaceName,
    ...ancestors.map((a) => a.title || "Untitled"),
    doc.title || "Untitled",
  ].join(" / ");

  const lines: string[] = [
    "---",
    `title: "${(doc.title || "Untitled").replace(/"/g, '\\"')}"`,
    `space: "${spaceName}"`,
    `scope: "${sameSpaceOnly ? "space-only" : "cross-space"}"`,
    `path: "${breadcrumb}"`,
    `updated_at: "${doc.updatedAt}"`,
    "---",
    "",
    `# ${doc.title || "Untitled"}`,
    "",
    doc.content.trim(),
  ];

  // 1. Direct nested child pages (scoped to same space when sameSpaceOnly is true)
  const childDocs = allDocs.filter(
    (d) => d.parentId === doc.id && (!sameSpaceOnly || d.spaceId === doc.spaceId)
  );
  if (childDocs.length > 0) {
    lines.push("", "---", "", "## Nested Child Pages");
    for (const child of childDocs) {
      const childSpace = spaceMap.get(child.spaceId) ?? "Space";
      lines.push(
        "",
        `### ${child.title || "Untitled"} (${childSpace})`,
        "",
        child.content.trim()
      );
    }
  }

  // 2. Directly linked documents via [[Wiki-Links]]
  const wikiTitles = extractWikiLinks(doc.content);
  const includedIds = new Set<string>([doc.id, ...childDocs.map((c) => c.id)]);
  const linkedDocs: BriefDocument[] = [];
  const externalSpaceRefs: Array<{ title: string; spaceName: string }> = [];

  for (const rawTitle of wikiTitles) {
    const match = allDocs.find(
      (d) =>
        !includedIds.has(d.id) &&
        d.title.trim().toLowerCase() === rawTitle.trim().toLowerCase()
    );
    if (!match) continue;

    if (sameSpaceOnly && match.spaceId !== doc.spaceId) {
      externalSpaceRefs.push({
        title: match.title || "Untitled",
        spaceName: spaceMap.get(match.spaceId) ?? "Other Space",
      });
      continue;
    }

    includedIds.add(match.id);
    linkedDocs.push(match);
  }

  if (linkedDocs.length > 0) {
    lines.push("", "---", "", `## Linked Documents (${spaceName})`);
    for (const linked of linkedDocs) {
      lines.push(
        "",
        `### [[${linked.title || "Untitled"}]]`,
        "",
        linked.content.trim()
      );
    }
  }

  if (externalSpaceRefs.length > 0) {
    lines.push("", "---", "", "## Cross-Space References (Excluded from Context)");
    for (const ref of externalSpaceRefs) {
      lines.push(`- \`[[${ref.title}]]\` (${ref.spaceName})`);
    }
  }

  // 3. Referenced Kanso tickets (#KEY-123)
  const combinedContent = [
    doc.content,
    ...childDocs.map((c) => c.content),
    ...linkedDocs.map((l) => l.content),
  ].join("\n");
  const tickets = extractTicketIdentifiers(combinedContent);

  if (tickets.length > 0) {
    lines.push("", "---", "", "## Referenced Kanso Tickets");
    for (const ticket of tickets) {
      lines.push(`- \`#${ticket}\``);
    }
  }

  return lines.join("\n").trim() + "\n";
}

export function buildSpaceContextMarkdown(
  space: Space,
  allDocs: BriefDocument[]
): string {
  const spaceDocs = allDocs.filter((d) => d.spaceId === space.id);
  const spaceDocIds = new Set(spaceDocs.map((d) => d.id));
  const childrenByParent = new Map<string | null, BriefDocument[]>();

  for (const doc of spaceDocs) {
    const parentKey =
      doc.parentId && spaceDocIds.has(doc.parentId) ? doc.parentId : null;
    const list = childrenByParent.get(parentKey) ?? [];
    list.push(doc);
    childrenByParent.set(parentKey, list);
  }

  const orderedDocs: Array<{ doc: BriefDocument; depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      orderedDocs.push({ doc: child, depth });
      visit(child.id, depth + 1);
    }
  };
  visit(null, 0);

  const lines: string[] = [
    "---",
    `space: "${space.name}"`,
    `slug: "${space.slug}"`,
    `document_count: ${orderedDocs.length}`,
    "---",
    "",
    `# Space: ${space.name}`,
  ];

  for (const { doc, depth } of orderedDocs) {
    const headingPrefix = "#".repeat(Math.min(2 + depth, 4));
    lines.push(
      "",
      "---",
      "",
      `${headingPrefix} ${doc.title || "Untitled"}`,
      "",
      doc.content.trim()
    );
  }

  const tickets = extractTicketIdentifiers(
    orderedDocs.map((item) => item.doc.content).join("\n")
  );
  if (tickets.length > 0) {
    lines.push("", "---", "", "## Referenced Kanso Tickets");
    for (const ticket of tickets) {
      lines.push(`- \`#${ticket}\``);
    }
  }

  return lines.join("\n").trim() + "\n";
}
