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

### 1. Download configuration

```bash
curl -O https://raw.githubusercontent.com/mxw02/brief/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/mxw02/brief/main/.env.example
cp .env.example .env
```

### 2. Configure environment variables

Edit `.env` and set strong secrets (especially `POSTGRES_PASSWORD` and `AUTH_SECRET`):

```bash
# Example: generate a secure random secret
openssl rand -base64 32
```

### 3. Start Brief

```bash
docker compose up -d
```

Brief will be available at `http://localhost:3000` (or the `APP_URL` configured in `.env`).

### Container Images

Pre-built multi-architecture images (`linux/amd64`, `linux/arm64`) are published automatically to the GitHub Container Registry:

- `ghcr.io/mxw02/brief:latest` — latest stable release
- `ghcr.io/mxw02/brief:vX.Y.Z` — pinned semantic version release
- `ghcr.io/mxw02/brief:develop` — latest development build from `develop`

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
