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

export function buildAgentContextMarkdown(
  doc: BriefDocument,
  allDocs: BriefDocument[],
  spaces: Space[]
): string {
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
    `path: "${breadcrumb}"`,
    `updated_at: "${doc.updatedAt}"`,
    "---",
    "",
    `# ${doc.title || "Untitled"}`,
    "",
    doc.content.trim(),
  ];

  // 1. Direct nested child pages
  const childDocs = allDocs.filter((d) => d.parentId === doc.id);
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

  for (const rawTitle of wikiTitles) {
    const match = allDocs.find(
      (d) =>
        !includedIds.has(d.id) &&
        d.title.trim().toLowerCase() === rawTitle.trim().toLowerCase()
    );
    if (match) {
      includedIds.add(match.id);
      linkedDocs.push(match);
    }
  }

  if (linkedDocs.length > 0) {
    lines.push("", "---", "", "## Linked Documents");
    for (const linked of linkedDocs) {
      const linkedSpace = spaceMap.get(linked.spaceId) ?? "Space";
      lines.push(
        "",
        `### [[${linked.title || "Untitled"}]] (${linkedSpace})`,
        "",
        linked.content.trim()
      );
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
