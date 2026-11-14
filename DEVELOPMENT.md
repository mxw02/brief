# Brief — Development Guide

Dieser Guide beschreibt Architektur, lokales Setup, Design-System, Git-/Release-Workflows sowie die technische Roadmap (**Kanso Board `BRIE`**) für **Brief**.

---

## 1. Tech-Stack & Architektur

- **Framework:** Next.js 15 (App Router, `output: "standalone"`) mit React 19
- **Sprache:** TypeScript (`strict: true`)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Datenbank:** PostgreSQL 16 (lokal via Docker Compose; geplant: SQLite als Zero-Config-Default + PostgreSQL-Option in `BRIE-12`)
- **Container & Registry:** Multi-Stage `Dockerfile` (`node:22-alpine`) → GitHub Container Registry (`ghcr.io/mxw02/brief`)

---

## 2. Lokales Setup

### Voraussetzungen

- **Node.js** `>= 22` (inkl. `npm`)
- **Docker** & Docker Compose v2+

### Schritt-für-Schritt-Start

```bash
# 1. Repository klonen & auf develop wechseln
git clone https://github.com/mxw02/brief.git
cd brief
git checkout develop

# 2. Lokale Umgebungsvariablen anlegen
cp .env.example .env
# Für lokale Entwicklung außerhalb von Docker in .env anpassen:
# DATABASE_URL=postgresql://brief:brief_local_dev@localhost:5432/brief
# POSTGRES_PASSWORD=brief_local_dev

# 3. PostgreSQL starten
docker compose up -d postgres

# 4. Abhängigkeiten installieren & Dev-Server starten
npm install
npm run dev
```

Die Anwendung läuft standardmäßig unter **http://localhost:3000** (falls Port 3000 belegt ist, weicht Next.js automatisch auf den nächsten freien Port aus).

### Healthcheck

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"brief","timestamp":"..."}
```

---

## 3. Projektstruktur

```text
brief/
├── .github/
│   ├── ISSUE_TEMPLATE/        # Bug- & Feature-Templates
│   ├── workflows/
│   │   ├── ci.yml             # Lint, Typecheck, Tests & Build (develop & PRs)
│   │   ├── release-please.yml # Automatisches SemVer-Tagging & Changelog auf main
│   │   └── deploy.yml         # Multi-Arch Docker Build & Push nach GHCR
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml
├── src/
│   └── app/
│       ├── api/health/route.ts # Healthcheck-Endpunkt
│       ├── globals.css         # Tailwind v4 & Kanso-Design-Tokens
│       ├── layout.tsx          # Root-Layout (#FAFAFA, text-zinc-900)
│       └── page.tsx            # Start-Workspace
├── .env.example                # Vorlage für Umgebungsvariablen
├── docker-compose.yml          # Self-Hosting Compose (brief + postgres:16-alpine)
├── Dockerfile                  # Standalone Next.js Container-Image
├── next.config.ts              # Next.js Konfiguration (output: "standalone")
├── package.json                # Skripte & Abhängigkeiten
├── tsconfig.json               # TypeScript-Konfiguration
├── CHANGELOG.md                # Automatisch gepflegt durch Release Please
├── CONTRIBUTING.md             # Contribution-Richtlinien
├── DEVELOPMENT.md              # Dieser Guide
├── SECURITY.md                 # Security Policy
└── README.md                   # Projektübersicht & Self-Hosting Quickstart
```

---

## 4. Design-System (Kanso-Palette)

Die Farb-Tokens sind in [src/app/globals.css](src/app/globals.css) definiert und orientieren sich an einer klaren, ruhigen Oberfläche:

- **Hintergründe & Neutraltöne (`zinc`):**
  - Body: `#FAFAFA` (`bg-[#FAFAFA]`), App-Shell: `bg-zinc-50`
  - Karten, Header & Modals: `bg-white`
  - Sekundäre Flächen / Spalten: `bg-zinc-100/70`
  - Rahmen & Trennlinien: `border-zinc-200` / `border-zinc-200/80`
  - Typografie: `text-zinc-900` (primär), `text-zinc-700` / `text-zinc-500` (sekundär), `text-zinc-400` (gedimmt)
- **Primär- & Akzentfarben (`teal` / `kanso`):**
  - Primary Accent (`teal-700`): `#0f766e` (Logo-Badge, primäre Buttons, aktive Tabs, Fokus-Ringe)
  - Hover / Active (`teal-800`): `#115e59`
  - Leichte Flächen: `bg-teal-50` (`#f0fdfa`) mit `border-teal-200`
  - Agent-Akzent (`emerald-700`): `#047857` | Human-Akzent (`zinc-700`): `#3f3f46`
- **Status- & Semantikfarben:**
  - Erfolg / Done: `emerald-50` / `emerald-600` / `emerald-800`
  - Warnung / Review / Urgent: `amber`, `orange`, `rose` / `red` (`red-600` / `red-50`)
  - Roadmap / Ziele: `#2563eb` / `indigo-600`

---

## 5. Verfügbare npm-Skripte

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev` | Startet den Next.js-Entwicklungsserver |
| `npm run build` | Erstellt den optimierten Production-Build (`.next/standalone`) |
| `npm run start` | Startet den gebauten Production-Server |
| `npm run lint` | Führt ESLint (`eslint-config-next`) aus |
| `npm run typecheck` | Führt `tsc --noEmit` für strenge Typprüfung aus |

Vor jedem Pull Request sollten mindestens `npm run typecheck`, `npm run lint` und `npm run build` lokal erfolgreich durchlaufen.

---

## 6. Git-Workflow, Branches & CI/CD

### Branches

- **`main`** — Stabiler Release-Stand. Merges nach `main` lösen über `release-please.yml` automatisch Release-PRs, SemVer-Tags (`vX.Y.Z`), `CHANGELOG.md`-Updates und GitHub Releases aus.
- **`develop`** — Aktiver Integrations-Branch. Alle Feature- und Fix-Branches werden von `develop` abgezweigt und per PR zurück nach `develop` gemergt.
- **Feature-Branches** — Benennung bevorzugt mit Ticket-Referenz, z. B.:
  - `feat/BRIE-1-markdown-editor`
  - `fix/BRIE-3-search-ranking`
  - `docs/update-self-hosting`

### Conventional Commits

Commits (bzw. Squash-PR-Titel) müssen den [Conventional Commits](https://www.conventionalcommits.org/) folgen:

- `feat:` → Minor-Version (`0.1.0` → `0.2.0`)
- `fix:` → Patch-Version (`0.1.0` → `0.1.1`)
- `feat!:` / `BREAKING CHANGE:` → Major-Version (`0.1.0` → `1.0.0`)
- `docs:`, `chore:`, `ci:`, `refactor:`, `test:` → Keine automatische Versions-Erhöhung (außer explizit konfiguriert)

### Docker-Image-Tags (GHCR)

- Push auf `develop` → `ghcr.io/mxw02/brief:develop`
- Push auf `main` → `ghcr.io/mxw02/brief:edge` / `:main`
- Release-Tag `vX.Y.Z` → `ghcr.io/mxw02/brief:latest`, `:vX.Y.Z`, `:vX.Y`, `:vX`

---

## 7. Technische Roadmap (Kanso Board `BRIE`)

Die Umsetzung gliedert sich in vier aufeinander aufbauende Phasen:

### Phase 1: Schreiben & Struktur (Die Anti-Confluence-Basis)
- **BRIE-1** — Markdown Editor (`/commands`, `Cmd+K`, Syntax-Highlighting, Mermaid)
- **BRIE-2** — Spaces & Bidirektionale Backlinks (`[[Dokument]]`)
- **BRIE-3** — Instant-Volltextsuche (< 50ms)
- **BRIE-4** — Git-Sync / Local-First Option (`.md` Dateien)

### Phase 2: Die Brücke zu Kanso
- **BRIE-5** — Kanso Live-Ticket-Embeds (`#KANSO-123`)
- **BRIE-6** — Text-to-Ticket: Absatz zu Kanso-Ticket
- **BRIE-7** — Spec-Status Lebenszyklus (`Draft -> In Review -> Approved -> Outdated`)

### Phase 3: „Agent-Ready“ Features
- **BRIE-8** — Copy as Agent Context (1-Klick-Markdown-Export)
- **BRIE-9** — Nativer MCP-Server & Read/Write-API für Agenten
- **BRIE-10** — YAML Frontmatter-Metadaten für Agenten

### Phase 4: Collaboration & Self-Hosting
- **BRIE-11** — Minimalistische Inline-Kommentare mit 1-Klick Resolve
- **BRIE-12** — Self-Hosting: 30s Docker-Deploy (SQLite Default + Postgres Option)
- **BRIE-13** — Rollen- & Berechtigungsmodell (Admin, Editor, Viewer, Agent-Bot)

---

## 8. Lokaler Docker-Test

```bash
# Image lokal bauen
docker build -t brief:local .

# Container gegen lokales Postgres testen
docker run --rm -p 3000:3000 --env-file .env brief:local
```
