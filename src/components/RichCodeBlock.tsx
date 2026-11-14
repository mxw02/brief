"use client";

import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Code2, Copy, Eye } from "lucide-react";
import { MermaidDiagram } from "./MermaidDiagram";

const LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "bash",
  "sql",
  "json",
  "yaml",
  "go",
  "python",
  "markdown",
  "mermaid",
  "plaintext",
];

export function RichCodeBlock({
  node,
  updateAttributes,
}: NodeViewProps) {
  const language = (node.attrs.language as string) || "plaintext";
  const isMermaid = language === "mermaid";
  const [editingMermaid, setEditingMermaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeText = node.textContent;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <NodeViewWrapper className="my-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div
        contentEditable={false}
        className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-100/70 px-3 py-1.5 text-xs text-zinc-500 select-none"
      >
        <div className="flex items-center gap-2">
          <select
            value={LANGUAGES.includes(language) ? language : "plaintext"}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            aria-label="Code block language"
            className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-700 focus:border-teal-700 focus:outline-none"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          {isMermaid && (
            <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
              Diagram
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isMermaid && (
            <button
              type="button"
              onClick={() => setEditingMermaid((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-white hover:text-teal-700"
            >
              {editingMermaid ? (
                <>
                  <Eye className="h-3 w-3" />
                  Preview
                </>
              ) : (
                <>
                  <Code2 className="h-3 w-3" />
                  Edit Mermaid
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {isMermaid && !editingMermaid ? (
        <div contentEditable={false} className="p-2">
          <MermaidDiagram chart={codeText} />
        </div>
      ) : (
        <pre className="overflow-x-auto bg-white p-4 font-mono text-[13px] leading-relaxed text-zinc-800">
          <code>
            <NodeViewContent />
          </code>
        </pre>
      )}
    </NodeViewWrapper>
  );
}
