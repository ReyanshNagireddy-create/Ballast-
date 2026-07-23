# Roadmap

Public and honest: this is what we're building and why. Dates are directional;
order is commitment. Propose changes via
[rule proposals](https://github.com/ballast-dev/ballast/issues/new?template=rule_proposal.yml)
and feature requests — several shipped items started as community issues.

## Shipped (0.4)

- 18-rule engine with AST + text fallback, presets for 8 migration runners,
  same-file table tracking, inline suppressions, safety score
- CLI (auto-detection, stdin, pretty/JSON/GitHub formats) and GitHub Action
- Ballast Cloud: projects, check history, API keys, REST + GraphQL APIs
- Migration rehearsals with per-statement timings
- GitHub App check runs with inline annotations (via worker)
- Self-hosting via docker-compose

## Next (0.5 → 0.7)

- **Slack & webhook alerts** — blockers merged to protected branches page
  someone before the deploy does.
- **`ballast fix`** — apply the mechanical rewrites (add CONCURRENTLY,
  append NOT VALID, insert lock_timeout preamble) directly to migration
  files; the judgment-required fixes stay human.
- **Rehearsal lock profiles** — sample pg_locks during rehearsal so the
  report shows *which* locks were held how long, not just wall time.
- **Policy packs** — org-level rule bundles ("no destructive DDL without a
  ticket link in the suppression comment") for compliance-shaped teams.
- **SARIF output** — GitHub code-scanning integration alongside annotations.

## Later (0.8 → 1.0)

- **Drift detection** — compare live schema against migration history;
  catch the hand-applied hotfix that CI never saw.
- **MySQL engine** — same rule philosophy, different lock semantics. Gated
  on demand signal (tell us in the issue tracker).
- **Safe-apply orchestrator** — opt-in managed apply step: lock_timeout +
  retry loops + expand-contract sequencing, turning fixes we currently
  *suggest* into a runbook we *execute*.

## Non-goals

- **Owning your migrations.** No new DSL, no state file, no runner lock-in.
  The moment adopting Ballast requires rewriting migrations, we've lost the
  plot.
- **AI-judged gating.** Deterministic checks gate; anything probabilistic is
  suggestion-only, clearly labeled, and off by default.
