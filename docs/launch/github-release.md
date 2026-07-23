# Ballast v0.4.0 — the public launch ⚓

The open-source safety layer for Postgres migrations: catch locking
hazards, table rewrites, and downtime risks in CI — before production
finds them for you.

```bash
npx @ballast/cli check          # auto-detects prisma/, db/migrate/, drizzle/, …
```

## Highlights

- **18 rules** encoding real production incidents: non-concurrent index
  builds, NOT NULL columns without defaults, volatile-default rewrites,
  un-validated foreign keys and CHECKs, blocking unique constraints,
  renames/drops that break rolling deploys, VACUUM FULL in migrations,
  missing lock_timeout, and more.
- **Runner-aware analysis** — presets for Prisma, Django, Rails, Drizzle,
  Flyway, goose, and golang-migrate model whether your tool wraps
  migrations in a transaction (it changes what's safe).
- **False-positive suppression** — DDL against tables created in the same
  file stays silent; suppress deliberately with auditable
  `-- ballast-ignore` comments.
- **Fixes, not just findings** — every finding ships the mechanism and the
  safe rewrite, with SQL.
- **GitHub Action** with inline PR annotations (`--format github`).
- **Ballast Cloud** (also in this repo, self-hostable via docker-compose):
  check history, org policy, API keys, REST + GraphQL APIs, and migration
  rehearsals with per-statement timings.

## Install

| Surface | How |
| --- | --- |
| CLI | `npx @ballast/cli check` or `npm i -D @ballast/cli` |
| Engine (library) | `npm i @ballast/core` |
| GitHub Action | `uses: ballast-dev/ballast/action@v0.4.0` |
| Self-hosted cloud | `docker compose up --build` (see docs/self-hosting) |

## Verification

- 84 tests across engine, CLI, and web (`npm run test`)
- CI self-check: the CLI must fail `examples/prisma-app/unsafe` and pass
  `examples/prisma-app/safe` on every commit
- Benchmarks: docs/benchmarks.md (honest ones)

**Full docs:** https://ballast.dev/docs · **Playground:** https://ballast.dev/playground

Every rule encodes an incident. [Send us yours.](https://github.com/ballast-dev/ballast/issues/new?template=rule_proposal.yml)
