# LinkedIn Launch Post

*(Company page + founder repost. One image: PR annotation screenshot.)*

**Today we're launching Ballast — the open-source safety layer for Postgres migrations.** ⚓

If you run engineering at a company built on Postgres, some version of this
has happened to you: a routine schema migration — reviewed, tested,
four lines — locks a critical table in production. Writes queue, the
connection pool saturates, and a "zero-risk" deploy becomes an incident
review.

It's not an engineering-talent problem. The dangerous patterns are well
documented: non-concurrent index builds, in-place type changes,
constraint validation under exclusive locks, lock queues behind
long-running queries. But that knowledge is specialist knowledge, and
migrations are written by everyone. Code review can't reliably catch what
the diff doesn't show.

Ballast moves that knowledge into CI:

✅ Analyzes the SQL your existing tools generate — Prisma, Django, Rails,
Drizzle, Flyway. No workflow changes, no new DSL. Two minutes to adopt.
✅ Fails the pull request with the exact line, a plain-English explanation
of the failure mode, and the safe rewrite — so every finding also trains
the team.
✅ Open source (Apache-2.0) at the core: auditable safety tooling, usable
forever without an account.
✅ For teams: check history, org-wide policy, PR annotations, and migration
rehearsals against production-shaped data — one flat $99/month for the
whole organization, because safety visibility shouldn't be per-seat.

Our take: reliability tooling won the build pipeline (linters, tests, type
checkers are non-negotiable now). The database deserves the same gate.

🔗 github.com/ballast-dev/ballast
🧪 Try it on your own migration, no signup: ballast.dev/playground

If your team has a migration war story — we'd genuinely like to hear it.
The rule set grows by encoding incidents.

#Postgres #DeveloperTools #OpenSource #SRE #DatabaseReliability
