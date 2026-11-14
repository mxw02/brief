export type FrontmatterValue = string | string[];
export type FrontmatterMetadata = Record<string, FrontmatterValue>;

export interface ParsedFrontmatter {
  metadata: FrontmatterMetadata;
  body: string;
  hasFrontmatter: boolean;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function parseYamlValue(raw: string): FrontmatterValue {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    return { metadata: {}, body: markdown, hasFrontmatter: false };
  }

  const yamlBlock = match[1];
  const body = markdown.slice(match[0].length);
  const metadata: FrontmatterMetadata = {};

  let currentListKey: string | null = null;
  for (const line of yamlBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (currentListKey && trimmed.startsWith("- ")) {
      const item = trimmed.slice(2).trim().replace(/^["']|["']$/g, "");
      const existing = metadata[currentListKey];
      if (Array.isArray(existing)) {
        existing.push(item);
      } else {
        metadata[currentListKey] = [item];
      }
      continue;
    }

    currentListKey = null;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();
    if (!key) continue;

    if (!rest) {
      metadata[key] = [];
      currentListKey = key;
    } else {
      metadata[key] = parseYamlValue(rest);
    }
  }

  return { metadata, body, hasFrontmatter: true };
}

export function serializeFrontmatter(
  metadata: FrontmatterMetadata,
  body: string
): string {
  const entries = Object.entries(metadata).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : value.trim().length > 0
  );

  const cleanBody = body.replace(/^\r?\n+/, "");
  if (entries.length === 0) {
    return cleanBody;
  }

  const lines = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: [${value.join(", ")}]`;
    }
    return `${key}: ${value}`;
  });

  return `---\n${lines.join("\n")}\n---\n\n${cleanBody}`;
}

export function formatFrontmatterSearchText(
  metadata: FrontmatterMetadata
): string {
  return Object.entries(metadata)
    .map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(" ") : v}`)
    .join(" ");
}

export function matchesFrontmatterFilter(
  metadata: FrontmatterMetadata,
  key: string,
  expected: string
): boolean {
  const needle = expected.trim().toLowerCase();
  if (!needle) return true;
  const val = metadata[key];
  if (!val) return false;
  if (Array.isArray(val)) {
    return val.some((item) => item.toLowerCase().includes(needle));
  }
  return val.toLowerCase().includes(needle);
}
