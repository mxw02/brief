import {
  formatFrontmatterSearchText,
  parseFrontmatter,
} from "./frontmatter";
import type { BriefDocument, Space } from "./workspace";

export interface SearchIndexedDoc {
  doc: BriefDocument;
  spaceName: string;
  titleLower: string;
  spaceLower: string;
  plainText: string;
  plainTextLower: string;
}

export interface SearchResult {
  doc: BriefDocument;
  spaceName: string;
  score: number;
  snippet: string;
  matchedTerms: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  durationMs: number;
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[\[([^[\]\n]+)\]\]/g, "$1")
    .replace(/[#>*_~\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchIndex(
  documents: BriefDocument[],
  spaces: Space[]
): SearchIndexedDoc[] {
  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));

  return documents.map((doc) => {
    const spaceName = spaceMap.get(doc.spaceId) ?? "Space";
    const { metadata, body } = parseFrontmatter(doc.content);
    const metaText = formatFrontmatterSearchText(metadata);
    const plainText = [toPlainText(body), metaText].filter(Boolean).join(" ");
    return {
      doc,
      spaceName,
      titleLower: doc.title.toLowerCase(),
      spaceLower: spaceName.toLowerCase(),
      plainText,
      plainTextLower: plainText.toLowerCase(),
    };
  });
}

function buildSnippet(
  plainText: string,
  plainTextLower: string,
  terms: string[]
): string {
  if (!plainText) return "";

  let firstMatchIndex = -1;
  for (const term of terms) {
    const idx = plainTextLower.indexOf(term);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  if (firstMatchIndex === -1) {
    return plainText.slice(0, 140) + (plainText.length > 140 ? "…" : "");
  }

  const start = Math.max(0, firstMatchIndex - 48);
  const end = Math.min(plainText.length, firstMatchIndex + 100);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < plainText.length ? "…" : "";
  return `${prefix}${plainText.slice(start, end).trim()}${suffix}`;
}

export function searchDocuments(
  index: SearchIndexedDoc[],
  query: string,
  spaceIdFilter?: string | null
): SearchResponse {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    const filtered = spaceIdFilter
      ? index.filter((item) => item.doc.spaceId === spaceIdFilter)
      : index;
    const t1 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      results: filtered.map((item) => ({
        doc: item.doc,
        spaceName: item.spaceName,
        score: 0,
        snippet: buildSnippet(item.plainText, item.plainTextLower, []),
        matchedTerms: [],
      })),
      durationMs: Math.max(0, t1 - t0),
    };
  }

  const terms = trimmed.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const item of index) {
    if (spaceIdFilter && item.doc.spaceId !== spaceIdFilter) continue;

    let score = 0;
    let allMatched = true;

    for (const term of terms) {
      const inTitle = item.titleLower.includes(term);
      const inSpace = item.spaceLower.includes(term);
      const inBody = item.plainTextLower.includes(term);

      if (!inTitle && !inSpace && !inBody) {
        allMatched = false;
        break;
      }

      if (inTitle) {
        score += item.titleLower.startsWith(term) ? 12 : 8;
      }
      if (inSpace) score += 3;
      if (inBody) score += 2;
    }

    if (!allMatched) continue;

    if (item.titleLower.includes(trimmed)) score += 10;
    if (item.plainTextLower.includes(trimmed)) score += 4;

    results.push({
      doc: item.doc,
      spaceName: item.spaceName,
      score,
      snippet: buildSnippet(item.plainText, item.plainTextLower, terms),
      matchedTerms: terms,
    });
  }

  results.sort((a, b) => b.score - a.score);

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    results,
    durationMs: Math.max(0, t1 - t0),
  };
}
