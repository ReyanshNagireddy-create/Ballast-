# Summary

<!-- What does this PR do, and why? Link the issue if one exists. -->

## Kind of change

- [ ] New rule / rule behavior change
- [ ] Engine (splitter, parser, config, scoring)
- [ ] CLI / Action
- [ ] Cloud (web, API, worker)
- [ ] Docs

## For rule changes

- [ ] The `why` explains the precise Postgres mechanism (lock level, rewrite, version behavior)
- [ ] False-positive analysis: new-table tracking, preset semantics, and PG versions considered
- [ ] Tests cover: the dangerous case, the safe alternative, and the should-not-fire case
- [ ] Docs (`/docs/rules` renders from the registry — meta is the doc)

## Checklist

- [ ] `npm run test -w @ballast/core -w @ballast/cli` passes
- [ ] `npm run typecheck --workspaces --if-present` passes
- [ ] No new dependencies without discussion (the engine stays lean)
