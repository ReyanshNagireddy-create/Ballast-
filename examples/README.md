# Examples

Small, runnable demonstrations of Ballast on realistic migrations.

| Example | What it shows |
| --- | --- |
| [`prisma-app/`](./prisma-app) | A Prisma project with an **unsafe** migration pair and its **safe** rewrite — the before/after of every rule that fires. |
| [`raw-sql/`](./raw-sql) | Plain SQL migrations, including inline suppressions and a `ballast.config.json`. |
| [`github-actions/`](./github-actions) | Copy-paste CI workflows for the Action and the bare CLI. |

## Try them

```bash
# from the repository root, after `npm install && npm run build:packages`
node packages/cli/dist/index.js check examples/prisma-app/unsafe --preset prisma
# → exits 1 with blockers

node packages/cli/dist/index.js check examples/prisma-app/safe --preset prisma
# → exits 0, score 100
```

CI runs exactly this in the `self-check` job — the examples are executable
documentation, and they break the build if the engine stops agreeing with them.
