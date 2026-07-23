# Contributing to Ballast

Thanks for helping keep other people's production databases boring. This guide
covers setup, the contribution we want most (rules), and how we review.

## Development setup

```bash
git clone https://github.com/ballast-dev/ballast
cd ballast
npm install

# engine + CLI (no database needed)
npm run build:packages
npm run test            # vitest for @ballast/core and @ballast/cli

# the full cloud (needs Docker)
cp .env.example .env
docker compose up postgres -d
npm run db:generate && npm run db:migrate
npm run dev             # web on :3000
npm run dev:worker      # worker
```

The engine and CLI have **zero infrastructure requirements** — most
contributions never need a database.

## The contribution we want most: rules

Every rule encodes a production incident. If you've lived one, you're the
most qualified person to contribute it.

1. Open a [rule proposal](https://github.com/ballast-dev/ballast/issues/new?template=rule_proposal.yml)
   first — the discussion about mechanism and false positives *is* the design.
2. A rule lives in `packages/core/src/rules/` and implements `StatementRule`
   or `FileRule`. Its `meta.why` must explain the precise Postgres mechanism:
   which lock, which rewrite, which version-specific behavior.
3. Follow the two-path pattern: an AST path (when `pgsql-ast-parser`
   understands the statement) and a normalized-text fallback (when it
   doesn't). Unsupported syntax must degrade to *still checked*, never to
   *silently passed*.
4. Think about when the rule should **not** fire:
   - tables created in the same file (`targetsNewTable`)
   - runner transaction semantics (`stmt.inTransaction`, presets)
   - Postgres version (`ctx.config.pgVersion`)
5. Tests in `packages/core/test/` must cover the dangerous case, the safe
   alternative, and at least one should-not-fire case.
6. Register it in `rules/index.ts`. The docs site renders `/docs/rules`
   straight from the registry — your `meta` is the documentation.

## Non-rule contributions

- **Engine/CLI**: keep dependencies near zero; the engine currently has one
  runtime dependency and we like it that way.
- **Web/cloud**: match the existing component patterns; server components by
  default, `"use client"` only where interaction demands it.
- **Docs**: content lives in `apps/web/src/lib/*-content.ts` — typed blocks,
  no CMS.

## Quality bar

```bash
npm run typecheck --workspaces --if-present
npm run test -w @ballast/core -w @ballast/cli -w @ballast/web
```

CI also runs the `self-check` job: the CLI must keep failing
`examples/prisma-app/unsafe` and passing `examples/prisma-app/safe`. If your
change alters a rule's behavior, update the examples deliberately — they're
the contract.

## Commit & PR conventions

- Small PRs review faster; one rule or one behavior per PR.
- Explain *why* in the PR description; the diff explains *what*.
- A maintainer responds to rule proposals and PRs within a week; pings after
  that are welcome, not rude.

## Code of conduct

Be excellent to each other — see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
Postmortem culture applies here too: we critique mechanisms, never people.
