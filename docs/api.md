# API Reference

Base URL: `https://ballast.dev/api/v1` (self-hosted: `<your-host>/api/v1`).
Authenticated endpoints take `Authorization: Bearer blt_live_…` — create keys
in *project settings → API keys*. Keys are shown once and stored as SHA-256.

Errors are JSON: `{ "error": "<machine_code>", "message": "<human text>" }`.

## POST /api/v1/analyze — stateless analysis

Public, rate-limited (30 req/min per IP), max 128 KB SQL. Powers the
playground; useful for editor plugins and quick integrations. Submitted SQL
is analyzed in memory and **not persisted**.

```bash
curl -s https://ballast.dev/api/v1/analyze \
  -H "content-type: application/json" \
  -d '{
    "sql": "CREATE INDEX i ON users(email);",
    "config": { "preset": "prisma", "pgVersion": 15 }
  }'
```

**Body**: `{ sql, filename?, config? }` where `config` matches
`ballast.config.json` (`preset`, `pgVersion`, `wrapsInTransaction`, `failOn`,
`rules`).

**200** → full report:

```json
{
  "version": "0.4.0",
  "findings": [
    {
      "ruleId": "require-concurrent-index-creation",
      "severity": "blocker",
      "category": "locking",
      "message": "Index build on users will block all writes for its full duration.",
      "why": "A plain CREATE INDEX takes a SHARE lock…",
      "fix": { "summary": "Create the index concurrently", "sql": "CREATE INDEX CONCURRENTLY i ON users(email)" },
      "file": "playground.sql",
      "line": 1,
      "statement": "CREATE INDEX i ON users(email)"
    }
  ],
  "summary": { "files": 1, "statements": 1, "blockers": 1, "warnings": 0,
               "notices": 1, "score": 72, "grade": "B", "passed": false }
}
```

Errors: `400 invalid_json | invalid_request | invalid_config`, `429 rate_limited`.

## POST /api/v1/checks — store a check run

What `ballast check --upload` calls. **Body**: `{ report, meta? }`; `meta`
is `{ branch?, commit?, repository?, runUrl? }` (the CLI fills these from CI
env vars). **201** → `{ id, url }`. Findings are expanded asynchronously by
the worker; summaries are queryable immediately (`status: "QUEUED"` →
`"COMPLETE"`).

## GET /api/v1/checks — list runs

Query: `limit` (1–100, default 20), `cursor` (an id from a previous page).
**200** → `{ checks: [...], nextCursor }`. Scoped to the key's project.

## GET /api/v1/checks/:id — one run with findings

**200** → the run including `findings[]`. **404** if the id belongs to
another project (indistinguishable from nonexistent, by design).

## POST /api/v1/rehearsals — queue a rehearsal *(Team plan)*

**Body**: `{ sql, checkRunId? }` (≤512 KB). **202** → `{ id, status:
"QUEUED" }`. `402 plan_required` on the free plan.

## GET /api/v1/rehearsals/:id

**200** → `{ id, status, timings, error, startedAt, finishedAt }` where
`timings` is `[{ statement, ms }]` and `status` ∈
`QUEUED | RUNNING | SUCCEEDED | FAILED`.

## GraphQL — POST /api/graphql

Same Bearer auth and project scoping; mirrors the REST data model for
dashboard-style querying:

```graphql
query RecentFailures {
  project {
    name
    checkRuns(first: 10) {
      id passed score grade createdAt
      findings { ruleId severity file line }
    }
  }
}
```

## CLI environment variables

| Variable | Purpose |
| --- | --- |
| `BALLAST_API_KEY` | enables `--upload` |
| `BALLAST_API_URL` | override for self-hosted (default `https://ballast.dev/api/v1`) |

Upload failures print a warning and never change the CLI's exit code.
