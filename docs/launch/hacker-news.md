# Hacker News Launch

**Title:** Show HN: Ballast – catch Postgres migrations that will lock up production

**URL:** https://github.com/ballast-dev/ballast

## Submission text

Hi HN — we built Ballast after watching the same incident happen at three
different companies: a syntactically perfect migration passes review, runs
instantly in staging, and then takes an ACCESS EXCLUSIVE lock on a big
production table. Sometimes the DDL itself is slow (CREATE INDEX without
CONCURRENTLY blocks writes for the whole build). More often it's subtler:
the ALTER just *waits* for its lock behind one long-running query — and
Postgres queues every subsequent query behind the waiting ALTER. The
migration is fast; the queue is the outage.

Ballast is a static analyzer for migration SQL, wired into CI. It parses
the migrations your existing tool generates — Prisma, Django, Rails,
Drizzle, Flyway, goose, golang-migrate, or plain SQL — and checks them
against 18 rules encoding lock behavior, table rewrites, constraint
validation, and rolling-deploy compatibility. Findings come with the
mechanism and the safe rewrite (e.g. NOT VALID + VALIDATE CONSTRAINT
instead of a blocking foreign-key add).

Things that we think are technically interesting:

- Rules run on a real SQL AST (pgsql-ast-parser) with a normalized-text
  fallback, so syntax the parser can't model degrades to still-checked
  rather than silently-passed.

- The engine models your migration runner's transaction behavior. CREATE
  INDEX CONCURRENTLY cannot run in a transaction block — whether that's a
  bug in your migration depends on whether your runner wraps files in one
  (Django, Rails: yes by default; Prisma, golang-migrate: no). Same SQL,
  different verdict, and Ballast gets it right per tool.

- Tables created within the same migration are tracked and exempted from
  locking rules, which removes the false-positive class that makes people
  uninstall migration linters after the first init migration.

The engine and CLI are Apache-2.0 with one runtime dependency, no network
calls, no telemetry. There's a paid cloud (history, PR annotations, and
"rehearsals" — we actually execute your migration against a
production-shaped database you point us at, and report per-statement
timings), but the analyzer is complete without it and always will be.

Prior art we respect and compared against: squawk, strong_migrations,
Atlas, pgroll — there's a comparison in the README and honest benchmarks
in docs/benchmarks.md (we are not faster than the Rust linter; we think
we're more right).

Would love HN's war stories — the rule set literally grows by encoding
incidents, and there's an issue template for exactly that.

## Prepared answers

- **"Just review your migrations"** — we agree, and this is the reviewer
  that never gets tired. The number of engineers who know offhand which of
  ALTER TABLE's ~40 forms rewrite the table is small; the number who write
  migrations is everyone.
- **"lock_timeout solves this"** — lock_timeout turns an outage into a
  retryable failure — it's rule #18 and we recommend it in every fix. It
  doesn't help with the operations that *hold* the lock for their duration
  (index builds, rewrites); those need the concurrent/phased forms, which
  is what the other 17 rules are for.
- **"Postgres version differences?"** — config includes pgVersion; rules
  adjust (PG 11 metadata-only defaults, PG 12 NOT NULL via CHECK, enum
  ADD VALUE in transactions pre-12).
