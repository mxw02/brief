"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { MermaidDiagram } from "./MermaidDiagram";

interface CodeBlockProps {
  language: string;
  rawCode: string;
  children: ReactNode;
}

function CodeBlock({ language, rawCode, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <div className="group my-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-100/70 px-3.5 py-1.5 text-xs text-zinc-500">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-600">
          {language || "text"}
        </span>
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
      <pre className="overflow-x-auto bg-white p-4 text-[13px] leading-relaxed">
        <code className={language ? `language-${language}` : undefined}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return "";
}

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="brief-prose max-w-none text-zinc-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-2 border-b border-zinc-200/80 pb-2 text-3xl font-bold tracking-tight text-zinc-900">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-8 text-xl font-semibold tracking-tight text-zinc-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-base font-semibold text-zinc-900">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-3 leading-7 text-zinc-700">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1.5 pl-6 text-zinc-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-6 text-zinc-700">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-r-lg border-l-4 border-teal-700 bg-teal-50/60 px-4 py-2.5 text-sm text-zinc-700">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-zinc-200" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-teal-700 underline decoration-teal-700/30 underline-offset-2 hover:text-teal-800"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-zinc-200 bg-zinc-100/70 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="px-4 py-2.5">{children}</th>,
          td: ({ children }) => (
            <td className="border-t border-zinc-200/80 px-4 py-2.5 text-zinc-700">
              {children}
            </td>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const match = /language-([^\s]+)/.exec(className || "");
            const language = match ? match[1] : "";
            const rawCode = extractText(children).replace(/\n$/, "");
            const isBlock = Boolean(match) || rawCode.includes("\n");

            if (language === "mermaid") {
              return <MermaidDiagram chart={rawCode} />;
            }

            if (isBlock) {
              return (
                <CodeBlock language={language} rawCode={rawCode}>
                  {children}
                </CodeBlock>
              );
            }

            return (
              <code
                {...props}
                className="rounded-md border border-zinc-200/80 bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800"
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
