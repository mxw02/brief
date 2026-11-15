# Changelog

## 1.0.0 (2026-11-14)


### Features

* **agent:** add Copy as Agent Context 1-click Markdown export (BRIE-8) ([04810bb](https://github.com/mxw02/brief/commit/04810bb7b3e9d845403f4eb59d195a562bf4b7f4))
* **agent:** scope Agent Context to active space and add per-space export (BRIE-8) ([7b48619](https://github.com/mxw02/brief/commit/7b48619d76f03e0f7b6c7fc10057ec515b9e2e94))
* **BRIE-10:** YAML frontmatter metadata bar, search indexing, and API/MCP filtering ([bf21b47](https://github.com/mxw02/brief/commit/bf21b471de9961375ed6657559899053d256d92f))
* **BRIE-11:** jump to and highlight referenced text on comment click ([ac210cb](https://github.com/mxw02/brief/commit/ac210cb1d8f2d8f6a40d3822c8587f73b248cecc))
* **BRIE-11:** minimalist inline comments on text selection with 1-click resolve ([2007e6b](https://github.com/mxw02/brief/commit/2007e6b921e87361df30877a35890475eb96c72e))
* **BRIE-12:** 30s Docker deploy with SQLite default and optional PostgreSQL ([3f8171b](https://github.com/mxw02/brief/commit/3f8171b5c720b3e8db390bde7392aa5eb94b6639))
* **BRIE-13:** add auth flow, roles, per-space access, and human/agent attribution ([d787a99](https://github.com/mxw02/brief/commit/d787a99218fc08f2b5073e5c74d2ee77992c2f1f))
* **BRIE-13:** show dedicated no-space-access screen for unassigned users ([d691ca9](https://github.com/mxw02/brief/commit/d691ca981ed1aa760db64f0a7e605e950ff714a6))
* **BRIE-14:** expand document editor to full width ([85f6a28](https://github.com/mxw02/brief/commit/85f6a2817ebc0a03041cc12d535f39a600c76046))
* **BRIE-15:** add OpenID Connect (Keycloak) SSO with PKCE and auto-provisioning ([21223e2](https://github.com/mxw02/brief/commit/21223e2c80970014a684db2c8c7959094610c007))
* **BRIE-5:** add live # Kanso ticket picker in editor ([cd0a01d](https://github.com/mxw02/brief/commit/cd0a01d4d67d49afaffbc2396ea21d829c009e44))
* **BRIE-5:** Kanso live ticket embeds for #KEY-123 and ticket URLs ([49b158f](https://github.com/mxw02/brief/commit/49b158f7c5c7ddd6ede050c03e3fa1d25f55e6c9))
* **BRIE-6:** convert selected text to Kanso ticket with backlink ([2d3c9bf](https://github.com/mxw02/brief/commit/2d3c9bf3f3c4cfdc28ecfe22b02546114f24ada7))
* **BRIE-7:** add Ready for Review status between Draft and In Review ([68d9b4e](https://github.com/mxw02/brief/commit/68d9b4eecb3334755a8b214899861577ec7ca8d7))
* **BRIE-7:** default newly created pages to Draft status ([69a334a](https://github.com/mxw02/brief/commit/69a334af2d43be8660660531d085c7006b7b98a3))
* **BRIE-7:** spec status lifecycle (Draft -&gt; In Review -&gt; Approved -&gt; Outdated) with badges and filters ([305ee6b](https://github.com/mxw02/brief/commit/305ee6b8942dea9651cb6e796180379908fdd455))
* **BRIE-9:** add create_space MCP tool and sync new spaces in UI ([bf014c8](https://github.com/mxw02/brief/commit/bf014c8091d737cb22ac3f57a28333fbcdc5456f))
* **BRIE-9:** native MCP server, token-authenticated Read/Write API, and agent Draft proposals ([76f4bfd](https://github.com/mxw02/brief/commit/76f4bfd9001b1cf2cdbe9e9b05b5e329faa8fbdb))
* Brief v0.1.0 — Editor, Kanso Bridge, MCP/API, RBAC & OIDC SSO ([4920766](https://github.com/mxw02/brief/commit/49207669a681c74eac1735320c6bb2aa60c30ead))
* **editor:** add reusable structure templates to slash commands and palette (BRIE-1) ([16c3769](https://github.com/mxw02/brief/commit/16c3769c63d7498eae3f07223c3f57b8c3f4e0b5))
* **editor:** implement Markdown editor with /commands, Cmd+K, syntax highlighting, and Mermaid (BRIE-1) ([a768f66](https://github.com/mxw02/brief/commit/a768f6631623e64b9de4097b31a97a774b48e97a))
* **editor:** switch to Confluence-style rich text editor and nested page tree ([06099e9](https://github.com/mxw02/brief/commit/06099e99bd8f28d1412dcd5bcd436c15779c73eb))
* **navigation:** add Spaces sidebar, [[wiki-links]] autocomplete, and backlinks panel (BRIE-2) ([158fd62](https://github.com/mxw02/brief/commit/158fd62aedd8d66d2cb96f3ee1c81b88604931bd))
* **search:** implement instant full-text search index and modal (&lt;50ms) (BRIE-3) ([123b803](https://github.com/mxw02/brief/commit/123b803e69d35fe744ea2c307f11c22802a06a14))


### Bug Fixes

* **BRIE-5:** render all ticket embeds and style #KEY-123 chips inline ([2dcae13](https://github.com/mxw02/brief/commit/2dcae13e11866d640e8b5edf439cbf9d5a8e8501))
* **BRIE-9:** poll server workspace every 4s for live MCP spaces and drafts ([b28986f](https://github.com/mxw02/brief/commit/b28986f897615ede6519c75c15b98ab96c6a3aa7))
* **editor:** remove MD button, fix Mermaid syntax, and suppress DOM error injection ([3ae1b10](https://github.com/mxw02/brief/commit/3ae1b10f9c1a1d6ff7dc1c862548d458fa492e05))


### Miscellaneous Chores

* **BRIE-12:** make dedicated PostgreSQL container the Docker Compose default ([7c7f39f](https://github.com/mxw02/brief/commit/7c7f39f36a288dd139d95ee723467165492f180b))
* **BRIE-5:** default KANSO_API_URL to http://localhost:3000 ([4c20c67](https://github.com/mxw02/brief/commit/4c20c67dd87b7a64aed21a2193f45ef82a70b393))
* **BRIE-5:** increase ticket picker limit to 50 and show count ([a6cefde](https://github.com/mxw02/brief/commit/a6cefdec034efc64b8252e9e7497d13262ee8a5f))
* **BRIE-8:** reduce right header actions to single Copy Context button ([e9efe9a](https://github.com/mxw02/brief/commit/e9efe9a02e758f1590a7de3f03c8e69270ac92f5))
* **ci:** bump actions/checkout from 4 to 7 ([761b0f6](https://github.com/mxw02/brief/commit/761b0f67c4189281d41066d56a01880931928054))
* **ci:** bump actions/checkout from 4 to 7 ([8bd1c6b](https://github.com/mxw02/brief/commit/8bd1c6be06c62faa50e76f7fd8330d48ab1aeccc))
* **ci:** bump actions/setup-node from 4 to 7 ([7f97527](https://github.com/mxw02/brief/commit/7f975274a10ce6a9b767b50d60846c29025087d0))
* **ci:** bump actions/setup-node from 4 to 7 ([2e7f3db](https://github.com/mxw02/brief/commit/2e7f3db73d8ec24c2f8de5d172cc4f988bfed789))
* **ci:** bump docker/setup-buildx-action from 3 to 4 ([2a6832e](https://github.com/mxw02/brief/commit/2a6832e541b0716e5e267e8c6908d8d8192d43a9))
* **ci:** bump docker/setup-buildx-action from 3 to 4 ([794a0ad](https://github.com/mxw02/brief/commit/794a0ad50e14868473fa6f739aecb124563acc76))
* **ci:** bump docker/setup-qemu-action from 3 to 4 ([07708c4](https://github.com/mxw02/brief/commit/07708c4393c65447d86aa649676cf6d5013c9f50))
* **ci:** bump docker/setup-qemu-action from 3 to 4 ([6864aef](https://github.com/mxw02/brief/commit/6864aefbbbdfe3600523e18d2d55fad5e2e73c10))
* **ci:** bump googleapis/release-please-action from 4 to 5 ([5852afa](https://github.com/mxw02/brief/commit/5852afafa51ecc78922bba852f2b8a9cc835ae0f))
* **ci:** bump googleapis/release-please-action from 4 to 5 ([7133b6f](https://github.com/mxw02/brief/commit/7133b6f3e7485a3aff85f98100c417072fa1fb53))
* **docker:** bump node from 22-alpine to 25-alpine ([041863b](https://github.com/mxw02/brief/commit/041863bd6838b41b6445c1821d5344245d1582f8))
* **docker:** bump node from 22-alpine to 25-alpine ([d6a16a3](https://github.com/mxw02/brief/commit/d6a16a300905640d4f1b2d841fd1c0c4f705d34e))
* initialize open-source project, self-hosted setup, and CI/CD pipelines ([682cd31](https://github.com/mxw02/brief/commit/682cd31042786703423da6c082e9fd847ddb7708))
* scaffold Next.js 15 app, Kanso theme, and development guide ([52608a5](https://github.com/mxw02/brief/commit/52608a5816248dc7374cde28d5e01292a6cdb14f))
* **search:** remove latency badge from search modal (BRIE-3) ([80d0d86](https://github.com/mxw02/brief/commit/80d0d86c4a31bc1a94e0001278d6ab7e3c944735))

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
