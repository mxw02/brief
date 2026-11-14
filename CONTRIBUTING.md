# Contributing to Brief

Thank you for your interest in contributing to **Brief**! Whether you are fixing a bug, proposing a feature, improving documentation, or helping with self-hosting setups, your help is appreciated.

## Code of Conduct

This project adheres to the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Branching Strategy

Brief follows a two-branch workflow:

- **`main`**: Always contains stable, releasable code. Do not open feature PRs directly against `main` unless it is an urgent hotfix or a release PR.
- **`develop`**: The default integration branch for active development.

When working on a change:

1. Fork the repository and clone it locally.
2. Create a branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/my-feature
   ```
   Use descriptive prefixes:
   - `feat/...` for new features
   - `fix/...` for bug fixes
   - `docs/...` for documentation updates
   - `chore/...` for maintenance and tooling
3. Open your Pull Request against **`develop`**.

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) so that [Release Please](https://github.com/googleapis/release-please) can automatically generate changelogs and semantic version tags:

```text
<type>[optional scope]: <description>
```

Common types:
- `feat:` — A new feature (triggers a **minor** version bump)
- `fix:` — A bug fix (triggers a **patch** version bump)
- `docs:` — Documentation only changes
- `chore:` — Build process, dependencies, or auxiliary tool changes
- `ci:` — CI/CD workflow changes
- `refactor:` — Code change that neither fixes a bug nor adds a feature
- `test:` — Adding or updating tests
- Breaking changes: add `!` after type/scope (e.g., `feat!: drop Node 20 support`) or include `BREAKING CHANGE:` in the footer (triggers a **major** version bump).

## Pull Request Checklist

- [ ] Target branch is `develop` (unless hotfix/release).
- [ ] Commits or PR title follow Conventional Commits.
- [ ] All CI checks pass (lint, typecheck, tests, build).
- [ ] Documentation and `.env.example` are updated if configuration or behavior changed.
