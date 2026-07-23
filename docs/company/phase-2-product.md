# Phase 2 — The Product

*Internal spec, founding team. July 2026.*

## Vision

**Every schema change to every production database gets a safety check —
the way every commit gets CI.** Ballast becomes the default gate between
"migration written" and "migration applied," then grows into the reliability
layer for schema change generally: analysis → rehearsal → orchestrated safe
application.

## Product principles

1. **Deterministic core.** The engine is a static analyzer: same input, same
   output, no network, no AI. Trust is the product; nondeterminism is poison
   in a CI gate. (This is also why we open-source it.)
2. **Meet teams where they are.** Their migrations, their runner, their CI.
   Anything that requires workflow change is roadmap, not onboarding.
3. **Every finding teaches.** Message = what breaks. Why = the mechanism.
   Fix = the safe path, with SQL. A team that uses Ballast for a year should
   need it less — and want it more (that's what history/policy are for).
4. **Suppression is a feature.** Real teams drop tables on purpose. Inline,
   auditable `-- ballast-ignore` comments turn overrides into reviewed
   decisions instead of tool abandonment.

## Core (open source, Apache-2.0)

- **@ballast/core** — the engine: statement splitter (quotes, dollar-quotes,
  nested comments), real SQL parsing with text fallback, 18 rules across
  locking/rewrite/destructive/compatibility/operational categories,
  same-file table tracking, presets modeling 8 migration runners'
  transaction semantics, per-rule severity config, inline suppressions,
  0–100 safety score.
- **@ballast/cli** — `check` (auto-detection, globs, stdin), `init`
  (preset detection), `rules`; pretty/JSON/GitHub output; exit codes 0/1/2;
  `--upload` to cloud (never affects exit code).
- **GitHub Action** — composite action; inline PR annotations via workflow
  commands.

## Cloud (commercial)

- **Projects & history**: every check stored, diffable, linkable — "when did
  this repo last ship a blocker, and who suppressed it?"
- **PR annotations via GitHub App**: worker posts check runs with inline
  annotations — no tokens to wire in CI.
- **Org policy**: rule severities enforced centrally (config in repo governs
  the check; dashboard makes drift visible).
- **Rehearsals** (the premium wedge): worker applies the migration to a
  disposable schema on a customer-pointed, production-shaped database;
  per-statement wall-clock timings; failures with the exact Postgres error.
  Static analysis says *dangerous*; rehearsal says *4 minutes 12 seconds*.
- **APIs**: REST (`/api/v1`: analyze, checks, rehearsals) + GraphQL mirror.

## Roadmap (public version in docs/roadmap.md)

- **Now (0.4)** — everything above, shipped.
- **Next (0.5–0.7)**: Slack/webhook alerting on blockers reaching default
  branches · rehearsal lock-profile capture (pg_locks sampling during
  rehearsal) · `ballast fix` auto-rewrite for the mechanical fixes ·
  org-level policy packs (SOC2-ish "no destructive DDL without ticket link").
- **Later (0.8–1.0)**: drift detection (schema in prod vs. migrations) ·
  MySQL engine · safe-apply orchestrator (lock_timeout + retry loops as a
  managed apply step — the pgroll-adjacent expansion, opt-in at the *end* of
  the funnel instead of the start).

## AI stance (deliberate)

The check is deterministic, full stop. AI appears in exactly one future
surface: translating a finding into a *project-specific* remediation PR
(backfill scripts, dual-write scaffolding) — suggestion, never gate. This is
a differentiator against the "AI code review" wave: we sell the thing AI
can't do, which is being reliably right about lock semantics.

## User journeys

1. **Solo dev (open source)**: sees launch post → playground: pastes last
   week's migration → two blockers, one is real → `npx @ballast/cli check` →
   adds the workflow file → done in 4 minutes. No account exists anywhere in
   this loop.
2. **Team adoption (free → Team)**: platform eng adds Action org-wide →
   two weeks of annotations educate the team → wants history + "who
   suppressed what" + rehearsals for the big table → creates project, API
   key, `--upload` in CI → hits the 1-project free limit on repo #2 →
   $99 flat is below the approval threshold → Team.
3. **Enterprise**: self-hosts from docker-compose in a security-review
   sandbox → SSO + SLA + custom retention conversation → annual contract.

## Onboarding (first-run quality bar)

- CLI with no args finds migrations by convention and prints something
  useful — zero-config first success.
- Empty dashboard states contain the exact copy-paste commands (they do).
- The unsafe/safe example pair in `examples/` is executable documentation,
  enforced by CI's self-check job.

## Pricing & business model

| | Free / OSS | Team — $99/org/mo flat | Enterprise — annual |
| --- | --- | --- | --- |
| Engine, CLI, Action | ✅ forever | ✅ | ✅ |
| Cloud projects | 1, 14-day history | Unlimited, full history | Unlimited |
| Rehearsals | — | ✅ | ✅ + isolated infra options |
| GitHub App annotations | — | ✅ | ✅ |
| Policy | repo config | org-wide | policy packs, custom rules |
| Support | community | priority | SLA, security review, SSO/SCIM, self-host |

Why flat per-org: safety tooling has to be visible to *everyone* (reviewers,
on-call, new hires); per-seat pricing fights the product's own success. Flat
$99 sits under most managers' no-approval threshold and makes expansion
revenue come from Enterprise, where the value story (compliance, SLA,
self-host) actually justifies sales time.

Unit economics sketch: COGS per Team org is cents (checks are milliseconds of
CPU; rehearsals run on customer databases). Support is the real cost driver —
which the teaching-first product design directly suppresses.

## Success metrics

- **Activation**: first check with ≥1 finding within 10 minutes of landing.
- **Retention proxy**: % of orgs where the check is *required* in branch
  protection after 30 days.
- **OSS health**: rule proposals opened by non-team members per month.
- **Revenue**: free→Team conversion at the 1-project limit; logo retention.
