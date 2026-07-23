# Product Hunt Launch

**Name:** Ballast
**Tagline (60 chars):** Catch dangerous Postgres migrations before production does
**Topics:** Developer Tools, Open Source, Databases, GitHub
**Links:** ballast.dev · github.com/ballast-dev/ballast · ballast.dev/playground

## Gallery order

1. Terminal: `ballast check` failing a real Prisma migration with fixes
2. PR diff with inline annotations on the dangerous line
3. Playground: paste SQL → findings with safe rewrites
4. Dashboard: check history with safety scores
5. Rehearsal report: per-statement timings

## First comment (from the maker)

Hey Product Hunt 👋

Every backend team has this story: a four-line migration passes review,
runs instantly in staging, then hits the production table with 200M rows —
and suddenly writes are blocked, the connection pool is full, and someone's
typing "incident" into Slack.

The maddening part is that the dangerous patterns are *known*. `CREATE
INDEX` without `CONCURRENTLY` blocks writes. `ALTER COLUMN TYPE` rewrites
the table under an exclusive lock. Adding a foreign key without `NOT VALID`
locks two tables. This knowledge lives in postmortems and the heads of
people who've been burned — everywhere except your CI.

**Ballast is the safety layer.** It reads the SQL your migration tool
already generates (Prisma, Django, Rails, Drizzle, Flyway, plain SQL —
no new DSL, no workflow change), checks it against 18 rules encoding how
Postgres locking actually works, and fails the PR with the exact line, the
mechanism, and the safe rewrite.

A few things we're proud of:

🔍 **It models your migration runner, not just SQL.** `CREATE INDEX
CONCURRENTLY` is correct under Prisma and a guaranteed failure under
Django's default transaction wrapping. Ballast knows the difference.

🤫 **False positives are treated as bugs.** Tables created in the same
migration are exempt from locking rules — your initial migration won't
scream 40 warnings.

⚓ **The engine is Apache-2.0, forever.** No account, no network calls.
The cloud ($99/mo flat, whole org) adds history, PR annotations, and
*rehearsals* — we apply your migration to a production-shaped database
first and tell you it takes 4m12s *before* deploy day.

Try the playground with the scariest migration you shipped this year:
ballast.dev/playground — curious what it finds.

We'll be here all day. Tell us where we're wrong; rule proposals welcome. ⚓

## Responses we've pre-drafted

- **"How is this different from squawk?"** — squawk is a good linter and we
  say so in our docs. Ballast adds runner-transaction semantics, same-file
  false-positive suppression, fix rewrites with SQL, and the team layer
  (history, policy, annotations, rehearsals). If squawk covers your needs,
  keep it — the more checked migrations in the world the better.
- **"Why not MySQL?"** — Lock semantics are where the danger lives and they
  differ per engine. We'd rather be precisely right about one engine than
  vaguely right about two. MySQL is on the public roadmap, gated on demand.
- **"Is this AI?"** — No. The check is a deterministic static analyzer —
  same input, same answer, works offline. We think that's a feature.
