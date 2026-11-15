# Brief

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/mxw02/brief/actions/workflows/ci.yml/badge.svg)](https://github.com/mxw02/brief/actions/workflows/ci.yml)
[![Release](https://github.com/mxw02/brief/actions/workflows/release-please.yml/badge.svg)](https://github.com/mxw02/brief/actions/workflows/release-please.yml)
[![Docker](https://github.com/mxw02/brief/actions/workflows/deploy.yml/badge.svg)](https://github.com/mxw02/brief/actions/workflows/deploy.yml)

**Brief** is an open-source, self-hosted alternative to Confluence — built for teams that want fast, structured documentation without vendor lock-in.

> [!NOTE]
> Brief is currently in early development. Contributions, ideas, and feedback are very welcome!

---

## Features (Planned & Core)

- **Self-Hosted First** — Run on your own infrastructure with a single `docker compose up -d`.
- **Spaces & Nested Pages** — Organize team knowledge in clean hierarchies.
- **Modern Editor** — Fast, keyboard-friendly Markdown and block-based editing.
- **Full-Text Search** — Find pages, decisions, and notes in milliseconds.
- **Permissions & Access Control** — Granular space and page permissions for teams.
- **Open & Portable** — Your data stays in PostgreSQL and standard Markdown/JSON formats.

---

## Self-Hosting Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2+

### 1. Download configuration & initialize secrets

```bash
git clone https://github.com/mxw02/brief.git && cd brief
./scripts/init.sh
```

The init script automatically creates `.env` from `.env.example` and generates secure random values for `AUTH_SECRET`, `POSTGRES_PASSWORD`, and `DATABASE_URL` (no manual `openssl` command required). Adjust `APP_URL`, `KANSO_API_URL`, or `OIDC_*` in `.env` if needed.

### 2. Start Brief

```bash
docker compose up -d
```

Or combine both steps in one command: `./scripts/init.sh --up`.

Brief will be available at `http://localhost:3000` (or the `APP_URL` configured in `.env`).

### Container Images

Pre-built multi-architecture images (`linux/amd64`, `linux/arm64`) are published automatically to the GitHub Container Registry:

- `ghcr.io/mxw02/brief:latest` — latest stable release
- `ghcr.io/mxw02/brief:vX.Y.Z` — pinned semantic version release
- `ghcr.io/mxw02/brief:develop` — latest development build from `develop`

---

## MCP Server (Model Context Protocol)

Brief exposes a built-in HTTP MCP server (`JSON-RPC 2.0`) so AI coding agents can search documentation, read specs/ADRs, and propose draft updates safely.

- **Endpoint:** `POST <APP_URL>/api/mcp` (`GET <APP_URL>/api/mcp` returns server info and available tools)
- **Authentication:** `Authorization: Bearer <token>` — create a token in the Brief UI (**Agent MCP & API** modal) or set `BRIEF_API_TOKEN` in `.env`.

### Client Configuration Example

```json
{
  "mcpServers": {
    "brief": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_BRIEF_API_TOKEN>"
      }
    }
  }
}
```

### Available MCP Tools

- `search_docs` — Full-text search across docs, specs, and ADRs
- `list_adrs` — List Architecture Decision Records and technical specs
- `list_spaces` / `create_space` — List or create Spaces
- `get_doc` — Read a document by ID or exact title (optionally with nested/linked Agent Context)
- `propose_draft` / `list_drafts` — Propose or list agent draft updates for human review

---

## Tech Stack

- **Runtime & Language:** Node.js / TypeScript
- **Database:** PostgreSQL
- **Containerization:** Docker & Docker Compose
- **CI/CD:** GitHub Actions, Release Please (SemVer + Changelog), GHCR Auto-Deploy

---

## Local Development

### Prerequisites

- Node.js `>= 22`
- Docker (for local PostgreSQL)

### Setup

```bash
git clone https://github.com/mxw02/brief.git
cd brief
git checkout develop
cp .env.example .env
```

See the [Development Guide](DEVELOPMENT.md) for the full local setup, architecture, design tokens, and roadmap.

---

## Branching & Release Workflow

- `main` — Stable production branch. Merges to `main` trigger [Release Please](https://github.com/googleapis/release-please) to create a Release PR, bump SemVer tags (`vX.Y.Z`), update `CHANGELOG.md`, and publish a GitHub Release.
- `develop` — Active integration branch. All feature (`feat/*`) and fix (`fix/*`) branches are branched from and merged into `develop`. Pushes to `develop` automatically build and push `ghcr.io/mxw02/brief:develop`.

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.

## Security

If you discover a security vulnerability, please follow the instructions in [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

Brief is licensed under the [MIT License](LICENSE).
