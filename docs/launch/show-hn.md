# Show HN post (honest draft)

**Title:** Show HN: Ballast – catch Postgres migrations that will lock up production

**URL:** https://github.com/ReyanshNagireddy-create/Ballast-

---

## Submission text

Ballast is a static analyzer for Postgres migration SQL that runs in CI.

The failure mode it targets: a syntactically perfect migration passes code
review, runs instantly against a small staging database, and then takes an
ACCESS EXCLUSIVE lock on a large production table. Sometimes the DDL itself
is slow — `CREATE INDEX` without `CONCURRENTLY` blocks writes for the entire
build. More often it's subtler: the `ALTER` just *waits* for its lock behind
one long-running query, and Postgres queues every subsequent query behind
the waiting `ALTER`. The migration is fast. The queue is the outage.

Ballast parses the migrations your existing tool already generates — Prisma,
Django, Rails, Drizzle, Flyway, goose, golang-migrate, or plain SQL — and
checks them against 18 rules covering lock behavior, table rewrites,
constraint validation, destructive operations, and rolling-deploy
compatibility. Each finding reports the mechanism and the safe rewrite (e.g.
`ADD CONSTRAINT ... NOT VALID` followed by `VALIDATE CONSTRAINT`, instead of
a foreign-key add that validates under an exclusive lock).

Three things I think are technically interesting:

- **Rules run on a real SQL AST** (pgsql-ast-parser) with a normalized-text
  fallback, so syntax the parser can't model degrades to still-checked
  rather than silently-passed.

- **The engine models your migration runner's transaction behavior.**
  `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block —
  whether that's a bug in your migration depends on whether your runner
  wraps files in one (Django and Rails do by default; Prisma and
  golang-migrate don't). Same SQL, different verdict, resolved per preset.

- **Tables created within the same migration are tracked and exempted from
  locking rules.** That removes the false-positive class that makes people
  uninstall migration linters right after their first init migration
  produces forty warnings.

The engine and CLI are Apache-2.0 with one runtime dependency, no network
calls, and no telemetry.

### Where this actually stands

This is new, and I'd rather say so than have you find out:

- **Not published to npm yet.** To try it: clone the repo, `npm install`,
  `npm run build:packages`, then `node packages/cli/dist/index.js check`.
- **No production users, no track record.** The rules encode documented
  Postgres locking behavior and well-known failure modes — not incidents I
  personally responded to. I'd like the rule set to grow from real
  incidents, which is why there's an issue template for exactly that.
- **78 tests** across the engine and CLI (`npm run test`), plus a CI check
  that requires the CLI to fail `examples/prisma-app/unsafe` and pass
  `examples/prisma-app/safe` on every commit.
- There's a **cloud layer in the repo** (check history, PR annotations, and
  "rehearsals" — executing a migration against a disposable
  production-shaped database and reporting per-statement timings). It's
  self-hostable via docker-compose. It is **not** a service I'm running for
  anyone today, and the analyzer is complete without it.

Prior art I looked at and respect: **squawk** (closest to this, and written
in Rust — it is faster than Ballast, and I say so in docs/benchmarks.md),
**strong_migrations**, **Atlas**, and **pgroll**.

Honest question for HN, more than a pitch: for those of you who've had a
migration cause an incident — what actually caught it, or what would have?
I'm most interested in the failure modes that *aren't* in the standard list.

---

## Prepared answers

- **"Just review your migrations."** Agreed — this is the reviewer that
  never gets tired. The number of engineers who know offhand which of
  `ALTER TABLE`'s ~40 forms rewrite the table is small; the number who
  write migrations is everyone.

- **"`lock_timeout` solves this."** `lock_timeout` turns an outage into a
  retryable failure, which is why it's a rule and appears in the fix text
  throughout. It doesn't help with operations that *hold* the lock for
  their full duration (index builds, table rewrites) — those need the
  concurrent or phased forms, which is what the other rules cover.

- **"How is this different from squawk?"** Overlapping goals. The
  differences I'd point to are runner-aware transaction semantics (per-tool
  presets) and same-file table tracking to kill false positives. squawk is
  faster and far more battle-tested. If you're choosing today on maturity
  alone, choose squawk — I'm not going to pretend otherwise.

- **"Postgres version differences?"** Config takes a `pgVersion` and rules
  adjust (PG 11 metadata-only defaults, PG 12 `NOT NULL` via CHECK
  constraint, enum `ADD VALUE` in transactions pre-12).

- **"Is this AI-generated?"** Answer this one honestly however it applies —
  people will ask, and a straight answer costs far less than a discovered
  evasion.

---

## Posting notes

- Show HN rules: you must be able to say people can *try* it. Either
  publish to npm first, or make sure the clone-and-build path in the README
  actually works from scratch — test it in a clean directory before posting.
- Post Tue–Thu, roughly 8–10am ET, and be around for the first two hours to
  reply to comments.
- Do not use the marketing copy in `docs/launch/` (product-hunt.md,
  linkedin.md, x-thread.md, press-kit.md) as-is. Those were drafted in the
  voice of an established company with a team, funding, a live site at
  ballast.dev, and approved press quotes. None of that exists. Rewrite in
  first person before publishing anywhere, or delete them.
