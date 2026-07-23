# Phase 1 — The Problem

*Internal memo, founding team. July 2026.*

## One sentence

Schema migrations are the highest-frequency self-inflicted cause of database
downtime for teams running Postgres, and the tools that generate those
migrations say nothing about the danger.

## Who has the problem

**Product engineering teams (5–500 engineers) running Postgres behind
ORMs** — Prisma, Django, Rails, Drizzle, SQLAlchemy — which is a large share
of every startup founded in the last decade. The person who feels it:

- The **backend engineer** who shipped a four-line migration that "worked in
  staging" and then blocked writes on a 200M-row table.
- The **on-call engineer** paged for "database locked up" that was actually a
  lock queue behind one ALTER TABLE.
- The **platform lead** who becomes the human migration-review bottleneck
  because they're the only one who knows which DDL takes which lock.

The knowledge to prevent these incidents exists — in Postgres docs, in
postmortems (GitLab, GoCardless, Braintree, and many others have published
excellent ones), in conference talks. It is *specialist* knowledge with a
*generalist* blast radius: any engineer can write a migration; few can audit
one.

## Why existing tools fail

| Tool | What it is | Why it doesn't close the gap |
| --- | --- | --- |
| **squawk** | Rust CLI linter for Postgres DDL | Excellent linter; but no runner-transaction awareness, no team layer (history, policy, dashboards), rule set frozen at "lint" — no rehearsal, no PR annotation service. |
| **strong_migrations** | Ruby gem | Rails-only. The Prisma/Drizzle/Django generation can't use it. |
| **Atlas (Ariga)** | Schema-as-code platform | Wants to *own* your migration workflow — new DSL, new CLI, new state. Adoption cost is a rewrite; most teams just want their existing migrations checked. |
| **pgroll / Reshape** | Zero-downtime migration executors | New migration format + new runtime component. Powerful, but a bet, not a safety net. |
| **Bytebase / Liquibase / Flyway policy** | Enterprise database change management | Heavyweight consoles aimed at DBAs and compliance; wrong shape and wrong buyer for a product-engineering team that lives in GitHub. |
| **Code review** | Humans | The whole problem: the danger is invisible in the diff and the reviewer is rarely a locking specialist. |

The pattern: existing answers either **lint without depth or context**
(squawk), **demand workflow adoption** (Atlas, pgroll), or **sell to a
different buyer** (Bytebase). Nobody owns the *"keep your workflow, add a
safety gate"* position — ESLint-for-your-database-changes, with a cloud that
makes it a team practice instead of an individual's habit.

## Why now

1. **The ORM generation hit scale.** Companies that adopted Prisma/Django/
   Rails in 2015–2022 now have the big tables that make dangerous DDL
   actually dangerous. The incidents are happening *now*.
2. **Postgres won.** Neon, Supabase, RDS, Cloud SQL — Postgres is the default
   startup database, which makes single-engine depth (our strategy) a large
   market rather than a niche.
3. **CI gating is a normalized muscle.** Teams already gate on lint, types,
   tests, and security scans. "Gate on migration safety" requires no behavior
   change — just a check that didn't exist before.
4. **Deploy frequency keeps rising.** More deploys → more migrations → more
   rolls of the dice. The expand-contract discipline that FAANG teams enforce
   with staff engineers needs to come as tooling for everyone else.

## Market size

Bottom-up: ~1M companies employ professional software teams; Postgres share
of new applications is commonly measured at 40–50% in developer surveys
(Stack Overflow's survey has ranked it the most-used and most-wanted database
in recent years). Call it ~300–400K organizations with production Postgres
and CI. At our $99/mo flat Team price, every 1% penetration of that base is
~$40M ARR. Enterprise (SSO, self-host, SLAs, custom retention) raises ACV on
the right tail — database change management deals at Liquibase/Bytebase-class
companies run $20–100K+/yr.

The honest framing: this is a **wedge market with expansion**. The wedge is
migration safety; the expansion is the operational layer around schema change
(rehearsals, deploy orchestration, drift detection, multi-engine) — the
"schema change reliability" category.

## Differentiation (why we win)

1. **Zero-adoption-cost positioning.** We are the only tool in the space
   whose pitch is "change nothing." No DSL, no runner, no state file. This is
   a *strategy*, not a feature gap — it makes us compatible with every
   competitor's user base, including Atlas's and pgroll's.
2. **Runner-transaction semantics.** The same SQL is safe under Prisma and
   fatal under Django. Modeling the migration *tool*, not just the SQL, is
   both technically real (we do it today) and rhetorically devastating in a
   head-to-head.
3. **False-positive suppression as a first-class feature.** Same-file table
   tracking kills the "initial migration screams 40 warnings" failure that
   gets linters uninstalled. Retention is the moat for a CI tool.
4. **Teaching output.** Every finding ships the mechanism and the safe
   rewrite. The tool creates its own power users.
5. **Open-source engine, flat-priced cloud.** Engine trust through
   auditability; cloud revenue through team value (history, policy,
   annotations, rehearsals) — not through holding the safety check hostage.

## Why developers switch (or rather, adopt — most have nothing to switch from)

The honest answer: **most targets run no migration safety tooling at all.**
Adoption cost is `npx @ballast/cli check` — under a minute to the first "oh
no" moment on their own repo, which is the conversion event. Against squawk
specifically: transaction-semantics awareness, fewer false positives, fix
rewrites, and a team product behind it. Against Atlas: we don't ask them to
change how they migrate. The playground ("paste your last migration") makes
the value demonstrable before any install.

## Risks we accept

- **Postgres-only narrows TAM initially** — accepted; depth is the
  differentiator, MySQL is a roadmap line with clear demand signal to watch.
- **squawk could add our features** — possible but it's a community CLI, not
  a company; our velocity + cloud layer is the bet.
- **Atlas could add a "lint-only" mode** — their incentive is workflow
  ownership; a lint-only mode undercuts their own adoption motion.
