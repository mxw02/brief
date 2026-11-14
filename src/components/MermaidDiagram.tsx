"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      primaryColor: "#f0fdfa",
      primaryTextColor: "#18181b",
      primaryBorderColor: "#0f766e",
      lineColor: "#52525b",
      secondaryColor: "#f4f4f5",
      tertiaryColor: "#ffffff",
      edgeLabelBackground: "#ffffff",
    },
  });
  mermaidInitialized = true;
}

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const reactId = useId();
  const diagramId = `brief-mermaid-${reactId.replace(/:/g, "")}`;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const trimmed = chart.trim();
    if (!trimmed) {
      setSvg("");
      setError(null);
      return;
    }

    ensureMermaidInit();

    mermaid
      .render(diagramId, trimmed)
      .then(({ svg: renderedSvg }) => {
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Invalid Mermaid syntax";
          setError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId]);

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
        <div className="font-semibold">Mermaid preview waiting for valid syntax</div>
        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-amber-800">
          {error}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-400">
        Rendering Mermaid diagram...
      </div>
    );
  }

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4">
      <div
        className="flex justify-center [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
