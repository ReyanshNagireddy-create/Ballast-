# X / Twitter Launch Thread

Post from @ballastdev; each numbered block is one post.

---

**1/**
Your ORM writes perfect SQL that takes down production.

Today we're launching Ballast — the open-source safety layer for Postgres
migrations. It catches locking hazards, table rewrites, and downtime risks
in CI, before deploy.

⚓ github.com/ballast-dev/ballast

**2/**
The incident is always the same:

- migration passes review (it's 4 lines, it's "obviously fine")
- runs instantly in staging (staging has 10k rows)
- hits production (200M rows, live traffic)
- writes blocked, pool full, pager on fire

**3/**
The cruelest version isn't even slow DDL.

An "instant" ALTER TABLE waits for an ACCESS EXCLUSIVE lock behind one
long analytics query. Postgres queues *every query arriving after it*
behind your ALTER.

The migration takes 40ms. The outage lasts as long as that analytics query.

**4/**
Ballast reads the SQL your tool already generates — Prisma, Django, Rails,
Drizzle, Flyway, plain SQL — and gates the PR:

❌ CREATE INDEX without CONCURRENTLY → blocks writes
❌ ALTER COLUMN TYPE → full rewrite under lock
❌ FK without NOT VALID → locks BOTH tables
✅ …and every finding ships the safe rewrite

**5/**
It knows things linters don't:

CREATE INDEX CONCURRENTLY *fails* inside a transaction. Whether your
migration runs in one depends on your tool — Django wraps by default,
Prisma doesn't.

Same SQL. Different verdict. Ballast models the runner, not just the SQL.

**6/**
And it won't cry wolf: tables created in the same migration are exempt
from locking rules, so your init migration doesn't scream 40 warnings.

False positives are treated as bugs. That's the whole retention strategy.

**7/**
The engine is Apache-2.0, forever. One dependency, no network calls,
deterministic. Try it right now — no account:

npx @ballast/cli check

Or paste your scariest migration into the playground:
ballast.dev/playground

**8/**
For teams: Ballast Cloud adds check history, org policy, PR annotations,
and rehearsals — we run your migration on a production-shaped database
first and tell you it takes 4m12s *before* deploy day.

$99/mo flat. Whole org. Not per seat — safety tooling everyone can see.

**9/**
Every rule in Ballast encodes a real incident. Ship us yours:
there's a rule-proposal template waiting for your war story.

⚓ Star: github.com/ballast-dev/ballast
📖 Why the lock queue is the outage: ballast.dev/blog/the-lock-queue-is-the-outage
