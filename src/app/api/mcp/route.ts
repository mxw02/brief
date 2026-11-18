import { NextResponse, type NextRequest } from "next/server";
import { requireAgentAuth } from "@/lib/agent-auth";
import { buildAgentContextMarkdown } from "@/lib/agent-context";
import {
  matchesFrontmatterFilter,
  parseFrontmatter,
} from "@/lib/frontmatter";
import { buildSearchIndex, searchDocuments } from "@/lib/search-index";
import {
  buildSpaceDocumentTree,
  createAgentDocument,
  createSpaceInStore,
  isAdrOrSpecDocument,
  moveDocumentInStore,
  proposeAgentDraft,
  readWorkspaceStore,
} from "@/lib/server-store";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const MCP_TOOLS = [
  {
    name: "search_docs",
    description:
      "Search Brief documentation, specs, and architecture decision records (ADRs) using full-text search.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (keywords, ADR number, spec topic)",
        },
        space: {
          type: "string",
          description: "Optional space ID, slug, or name filter",
        },
        includeDrafts: {
          type: "boolean",
          description: "Whether to include draft documents (default: false)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_adrs",
    description:
      "List Architecture Decision Records (ADRs) and technical Specs across Brief.",
    inputSchema: {
      type: "object",
      properties: {
        space: {
          type: "string",
          description: "Optional space ID, slug, or name filter",
        },
      },
    },
  },
  {
    name: "list_spaces",
    description: "List all Brief spaces and their document counts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_space",
    description: "Create a new Space in Brief (or return existing Space with the same slug).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Display name of the new Space",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_docs",
    description:
      "List the nested document tree inside Spaces (showing parent/child hierarchy, IDs, titles, and statuses).",
    inputSchema: {
      type: "object",
      properties: {
        space: {
          type: "string",
          description: "Optional space ID, slug, or name filter",
        },
        includeDrafts: {
          type: "boolean",
          description: "Whether to include draft documents (default: false)",
        },
      },
    },
  },
  {
    name: "get_doc",
    description:
      "Read a Brief document by ID or exact title, optionally including nested and linked same-space context.",
    inputSchema: {
      type: "object",
      properties: {
        idOrTitle: {
          type: "string",
          description: "Document ID (e.g. doc-arch) or exact title",
        },
        includeContext: {
          type: "boolean",
          description:
            "Include child pages and same-space [[Wiki-Linked]] docs as Agent Context Markdown",
        },
      },
      required: ["idOrTitle"],
    },
  },
  {
    name: "propose_draft",
    description:
      "Propose a new Changelog or Documentation update as a Draft for human review (supports nested parentId). Never overwrites published documents.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the proposed draft or changelog entry",
        },
        content: {
          type: "string",
          description: "Full Markdown content of the proposed update",
        },
        spaceId: {
          type: "string",
          description: "Target space ID, slug, or name (e.g. space-brief)",
        },
        parentId: {
          type: ["string", "null"],
          description:
            "Optional parent document ID or exact title to nest this page under (or null for root level)",
        },
        targetDocId: {
          type: "string",
          description:
            "Optional ID or exact title of an existing document this draft proposes to update",
        },
        summary: {
          type: "string",
          description: "Short summary of why this change is proposed",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_doc",
    description:
      "Create a new document (optionally nested under parentId). Publishes directly when Agent-Bot Draft-only policy is disabled; otherwise creates a Draft.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title",
        },
        content: {
          type: "string",
          description: "Full Markdown content",
        },
        spaceId: {
          type: "string",
          description: "Target space ID, slug, or name (e.g. space-brief)",
        },
        parentId: {
          type: ["string", "null"],
          description:
            "Optional parent document ID or exact title to nest this page under (or null for root level)",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "move_doc",
    description:
      "Move or re-parent an existing document within a Space or across Spaces to organize nested hierarchy (requires Agent-Bot Draft-only policy to be disabled).",
    inputSchema: {
      type: "object",
      properties: {
        idOrTitle: {
          type: "string",
          description: "Document ID or exact title to move",
        },
        parentId: {
          type: ["string", "null"],
          description:
            "New parent document ID or exact title, or null to move to Space root level",
        },
        spaceId: {
          type: "string",
          description: "Optional target space ID, slug, or name",
        },
      },
      required: ["idOrTitle"],
    },
  },
  {
    name: "list_drafts",
    description: "List pending agent-proposed Draft documents awaiting review.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

function jsonRpcResult(id: string | number | null | undefined, result: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  });
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string
) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

export async function GET() {
  return NextResponse.json({
    name: "brief-mcp",
    version: "1.0.0",
    protocol: "Model Context Protocol (JSON-RPC 2.0 over HTTP)",
    authentication: "Bearer token required on POST /api/mcp",
    tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAgentAuth(request);
  if (!auth.ok) return auth.response;

  let rpc: JsonRpcRequest;
  try {
    rpc = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = rpc;

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
      serverInfo: {
        name: "brief-mcp",
        version: "1.0.0",
      },
    });
  }

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 204 });
  }

  if (method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: MCP_TOOLS });
  }

  if (method === "resources/list") {
    const { spaces, documents } = await readWorkspaceStore();
    const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
    return jsonRpcResult(id, {
      resources: documents.map((doc) => ({
        uri: `brief://docs/${doc.id}`,
        name: doc.title,
        description: `${spaceMap.get(doc.spaceId) ?? "Space"} (${doc.status ?? "published"})`,
        mimeType: "text/markdown",
      })),
    });
  }

  if (method === "resources/read") {
    const uri = typeof params?.uri === "string" ? params.uri : "";
    const docId = uri.replace(/^brief:\/\/docs\//, "");
    const { documents } = await readWorkspaceStore();
    const doc = documents.find((d) => d.id === docId);
    if (!doc) {
      return jsonRpcError(id, -32602, `Resource not found: ${uri}`);
    }
    return jsonRpcResult(id, {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: `# ${doc.title}\n\n${doc.content}`,
        },
      ],
    });
  }

  if (method === "tools/call") {
    const toolName = typeof params?.name === "string" ? params.name : "";
    const args =
      params?.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};

    const { spaces, documents } = await readWorkspaceStore();
    const spaceMap = new Map(spaces.map((s) => [s.id, s]));

    if (toolName === "list_spaces") {
      const payload = spaces.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        documentCount: documents.filter((d) => d.spaceId === s.id).length,
      }));
      return jsonRpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      });
    }

    if (toolName === "create_space") {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!name) {
        return jsonRpcResult(id, {
          isError: true,
          content: [{ type: "text", text: "name must be a non-empty string" }],
        });
      }
      const space = await createSpaceInStore(name);
      return jsonRpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(space, null, 2) }],
      });
    }

    if (toolName === "search_docs") {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const spaceFilter =
        typeof args.space === "string" ? args.space.trim().toLowerCase() : "";
      const scopeFilter =
        typeof args.scope === "string" ? args.scope.trim() : "";
      const techStackFilter =
        typeof args.techStack === "string" ? args.techStack.trim() : "";
      const includeDrafts = Boolean(args.includeDrafts);

      const candidates = documents.filter((doc) => {
        if (!includeDrafts && doc.status === "draft") return false;
        if (spaceFilter) {
          const sp = spaceMap.get(doc.spaceId);
          if (
            doc.spaceId.toLowerCase() !== spaceFilter &&
            sp?.slug.toLowerCase() !== spaceFilter &&
            sp?.name.toLowerCase() !== spaceFilter
          ) {
            return false;
          }
        }
        if (scopeFilter || techStackFilter) {
          const { metadata } = parseFrontmatter(doc.content);
          if (
            scopeFilter &&
            !matchesFrontmatterFilter(metadata, "scope", scopeFilter)
          ) {
            return false;
          }
          if (
            techStackFilter &&
            !matchesFrontmatterFilter(metadata, "tech-stack", techStackFilter)
          ) {
            return false;
          }
        }
        return true;
      });

      const index = buildSearchIndex(candidates, spaces);
      const { results } = searchDocuments(index, query);
      return jsonRpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              results.slice(0, 20).map((r) => ({
                id: r.doc.id,
                title: r.doc.title,
                space: r.spaceName,
                status: r.doc.status ?? "approved",
                metadata: parseFrontmatter(r.doc.content).metadata,
                snippet: r.snippet,
              })),
              null,
              2
            ),
          },
        ],
      });
    }

    if (toolName === "list_adrs") {
      const spaceFilter =
        typeof args.space === "string" ? args.space.trim().toLowerCase() : "";
      const adrs = documents.filter((doc) => {
        if (doc.status === "draft") return false;
        if (!isAdrOrSpecDocument(doc)) return false;
        if (spaceFilter) {
          const sp = spaceMap.get(doc.spaceId);
          return (
            doc.spaceId.toLowerCase() === spaceFilter ||
            sp?.slug.toLowerCase() === spaceFilter ||
            sp?.name.toLowerCase() === spaceFilter
          );
        }
        return true;
      });
      return jsonRpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              adrs.map((d) => ({
                id: d.id,
                title: d.title,
                space: spaceMap.get(d.spaceId)?.name ?? "Space",
                updatedAt: d.updatedAt,
              })),
              null,
              2
            ),
          },
        ],
      });
    }

    if (toolName === "list_docs") {
      const spaceRef =
        typeof args.space === "string" ? args.space.trim() : undefined;
      const includeDrafts = Boolean(args.includeDrafts);
      const tree = buildSpaceDocumentTree(spaces, documents, {
        spaceRef,
        includeDrafts,
      });
      return jsonRpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(tree, null, 2) }],
      });
    }

    if (toolName === "get_doc") {
      const idOrTitle =
        typeof args.idOrTitle === "string" ? args.idOrTitle.trim() : "";
      const includeContext = Boolean(args.includeContext);
      const doc = documents.find(
        (d) =>
          d.id === idOrTitle ||
          d.title.toLowerCase() === idOrTitle.toLowerCase()
      );
      if (!doc) {
        return jsonRpcResult(id, {
          isError: true,
          content: [
            { type: "text", text: `Document not found: ${idOrTitle}` },
          ],
        });
      }

      const text = includeContext
        ? buildAgentContextMarkdown(doc, documents, spaces, {
            sameSpaceOnly: true,
          })
        : `# ${doc.title}\n\n${doc.content}`;

      return jsonRpcResult(id, {
        content: [{ type: "text", text }],
      });
    }

    if (toolName === "propose_draft") {
      const title = typeof args.title === "string" ? args.title : "";
      const content = typeof args.content === "string" ? args.content : "";
      if (!content.trim()) {
        return jsonRpcResult(id, {
          isError: true,
          content: [{ type: "text", text: "content must be a non-empty Markdown string" }],
        });
      }
      const parentId =
        args.parentId === null
          ? null
          : typeof args.parentId === "string"
            ? args.parentId
            : undefined;
      try {
        const draft = await proposeAgentDraft({
          title,
          content,
          spaceId: typeof args.spaceId === "string" ? args.spaceId : undefined,
          parentId,
          targetDocId:
            typeof args.targetDocId === "string" ? args.targetDocId : undefined,
          proposedBy: auth.agentName,
          summary: typeof args.summary === "string" ? args.summary : undefined,
        });

        return jsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "draft_created",
                  draftId: draft.id,
                  title: draft.title,
                  spaceId: draft.spaceId,
                  parentId: draft.parentId ?? null,
                  proposalTargetId: draft.proposalTargetId ?? null,
                  note: "Created as Draft for human review; published docs were not modified.",
                },
                null,
                2
              ),
            },
          ],
        });
      } catch (err) {
        return jsonRpcResult(id, {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : "Failed to propose draft",
            },
          ],
        });
      }
    }

    if (toolName === "create_doc") {
      const title = typeof args.title === "string" ? args.title : "";
      const content = typeof args.content === "string" ? args.content : "";
      if (!title.trim() || !content.trim()) {
        return jsonRpcResult(id, {
          isError: true,
          content: [
            { type: "text", text: "title and content must be non-empty strings" },
          ],
        });
      }
      const parentId =
        args.parentId === null
          ? null
          : typeof args.parentId === "string"
            ? args.parentId
            : undefined;
      try {
        const { doc, draftOnly } = await createAgentDocument({
          title,
          content,
          spaceId: typeof args.spaceId === "string" ? args.spaceId : undefined,
          parentId,
          authorName: auth.agentName,
        });
        return jsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: draftOnly ? "draft_created" : "published",
                  id: doc.id,
                  title: doc.title,
                  spaceId: doc.spaceId,
                  parentId: doc.parentId ?? null,
                  note: draftOnly
                    ? "Agent-Bot Draft-only policy is active; created as Draft for human review."
                    : "Document created and published.",
                },
                null,
                2
              ),
            },
          ],
        });
      } catch (err) {
        return jsonRpcResult(id, {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : "Failed to create document",
            },
          ],
        });
      }
    }

    if (toolName === "move_doc") {
      const idOrTitle =
        typeof args.idOrTitle === "string" ? args.idOrTitle.trim() : "";
      if (!idOrTitle) {
        return jsonRpcResult(id, {
          isError: true,
          content: [{ type: "text", text: "idOrTitle must be a non-empty string" }],
        });
      }
      const parentId =
        args.parentId === null
          ? null
          : typeof args.parentId === "string"
            ? args.parentId
            : undefined;
      const result = await moveDocumentInStore({
        idOrTitle,
        parentId,
        spaceId: typeof args.spaceId === "string" ? args.spaceId : undefined,
        authorName: auth.agentName,
      });
      if ("error" in result) {
        return jsonRpcResult(id, {
          isError: true,
          content: [{ type: "text", text: result.error }],
        });
      }
      return jsonRpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "moved",
                id: result.doc.id,
                title: result.doc.title,
                spaceId: result.doc.spaceId,
                parentId: result.doc.parentId ?? null,
              },
              null,
              2
            ),
          },
        ],
      });
    }

    if (toolName === "list_drafts") {
      const drafts = documents.filter((d) => d.status === "draft");
      return jsonRpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              drafts.map((d) => ({
                id: d.id,
                title: d.title,
                space: spaceMap.get(d.spaceId)?.name ?? "Space",
                proposedBy: d.proposedBy ?? "Agent",
                proposalTargetId: d.proposalTargetId ?? null,
                proposalSummary: d.proposalSummary ?? null,
                updatedAt: d.updatedAt,
              })),
              null,
              2
            ),
          },
        ],
      });
    }

    return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}
