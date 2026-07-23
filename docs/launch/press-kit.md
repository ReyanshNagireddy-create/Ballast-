# Ballast Press Kit

*For journalists, newsletter authors, and podcast hosts. Assets in
`assets/`; questions to press@ballast.dev.*

## Boilerplate (short)

Ballast is the open-source safety layer for Postgres schema migrations. It
analyzes the SQL that tools like Prisma, Django, and Rails generate and
blocks the changes that would lock tables, rewrite data under load, or
break running applications — in CI, before production. The engine is
Apache-2.0; Ballast Cloud adds team history, pull-request annotations, and
migration rehearsals for a flat $99/month per organization.

## Boilerplate (one line)

Ballast catches dangerous Postgres migrations in CI — before production
finds them for you.

## The story angles

1. **The invisible outage class.** Schema migrations are a leading
   self-inflicted cause of database downtime, yet the failure is invisible
   in code review: the SQL is *correct*, it's the lock behavior that's
   dangerous. Ballast makes a specialist skill (Postgres lock semantics) a
   CI check.
2. **Deterministic tooling in the AI wave.** Ballast is deliberately not
   AI: a reproducible static analyzer that gates deploys, launched into a
   market saturated with probabilistic assistants. "The check must be
   boring" is the thesis.
3. **Open-source wedge economics.** Apache-2.0 engine, flat-priced cloud,
   published benchmarks that credit competitors — a case study in
   trust-first developer-tools go-to-market.

## Facts

- **Product:** engine + CLI + GitHub Action (open source), cloud dashboard,
  API, migration rehearsals (commercial)
- **Rules:** 18, spanning locking, table rewrites, destructive operations,
  rolling-deploy compatibility, and operational hygiene
- **Supported workflows:** Prisma, Django, Rails, Drizzle, Flyway, goose,
  golang-migrate, raw SQL
- **License:** Apache-2.0 · **Pricing:** Free / $99 per org per month / Enterprise
- **Founded:** 2026 · Remote-first
- **Website:** ballast.dev · **Repo:** github.com/ballast-dev/ballast

## Approved quotes

> "Staging can't tell you what production will do. The table with 200
> million rows isn't in staging — that's why the migration 'worked.'"

> "Every rule in Ballast encodes a production incident someone actually
> had. We're turning postmortems into a CI check."

> "Safety tooling you can't audit is a contradiction. The engine is open
> source because trust is the product."

## Assets

| Asset | File |
| --- | --- |
| Logo (mark) | `assets/logo.svg` |
| Logo (wordmark) | `assets/logo-wordmark.svg` |
| Screenshots | `assets/screenshots/` |
| Brand guidelines | `docs/company/brand-guidelines.md` |
| Design tokens | `docs/company/design-tokens.json` |

Please don't recolor the mark, set the wordmark in another typeface, or
imply endorsement by companies we haven't named ourselves.
