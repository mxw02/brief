import { marked } from "marked";
import TurndownService from "turndown";
import { BRIEF_DOC_HREF_PREFIX, preprocessWikiLinks } from "./workspace";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});

// Convert TipTap Wiki-Link anchors (#brief-doc:Title) back to [[Title]]
turndown.addRule("wikiLink", {
  filter: (node) =>
    node.nodeName === "A" &&
    (node.getAttribute("href") ?? "").startsWith(BRIEF_DOC_HREF_PREFIX),
  replacement: (content, node) => {
    const href = (node as HTMLElement).getAttribute("href") ?? "";
    const target = decodeURIComponent(
      href.slice(BRIEF_DOC_HREF_PREFIX.length)
    );
    return `[[${target || content}]]`;
  },
});

// Convert TipTap TaskList items back to GFM - [ ] / - [x]
turndown.addRule("taskListItem", {
  filter: (node) =>
    node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem",
  replacement: (content, node) => {
    const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
    const clean = content
      .replace(/^\n+|\n+$/g, "")
      .replace(/\n/g, "\n  ");
    return `- [${checked ? "x" : " "}] ${clean}\n`;
  },
});

// Convert TipTap TaskList ul wrapper cleanly
turndown.addRule("taskList", {
  filter: (node) =>
    node.nodeName === "UL" && node.getAttribute("data-type") === "taskList",
  replacement: (content) => `\n${content}\n`,
});

export function markdownToHtml(markdown: string): string {
  const withWikiLinks = preprocessWikiLinks(markdown);
  const rawHtml = marked.parse(withWikiLinks, {
    gfm: true,
    breaks: false,
    async: false,
  });

  if (typeof rawHtml !== "string") return "";

  // Convert marked GFM task list items into TipTap TaskList/TaskItem HTML
  return rawHtml.replace(
    /<ul>\s*((?:<li>\s*<input[^>]*type="checkbox"[^>]*>[\s\S]*?<\/li>\s*)+)<\/ul>/g,
    (_, itemsHtml: string) => {
      const convertedItems = itemsHtml.replace(
        /<li>\s*<input([^>]*)type="checkbox"([^>]*)>\s*([\s\S]*?)<\/li>/g,
        (_m, before: string, after: string, text: string) => {
          const isChecked = /checked/i.test(`${before}${after}`);
          return `<li data-type="taskItem" data-checked="${isChecked}"><label><input type="checkbox"${isChecked ? " checked" : ""}><span></span></label><div><p>${text.trim()}</p></div></li>`;
        }
      );
      return `<ul data-type="taskList">${convertedItems}</ul>`;
    }
  );
}

export function htmlToMarkdown(html: string): string {
  if (!html || html === "<p></p>") return "";
  return turndown.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}
