export type DocBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string; id?: string }
  | { kind: "code"; lang: string; title?: string; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  blocks: DocBlock[];
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: "quickstart",
    title: "Quickstart",
    description: "From zero to a gated CI check in about two minutes.",
    blocks: [
      {
        kind: "p",
        text: "Ballast analyzes the SQL your migration tool already generates. There is nothing to adopt, rewrite, or migrate to — point the CLI at your migrations and it tells you what would have hurt in production.",
      },
      { kind: "h2", text: "Run it once, right now" },
      {
        kind: "code",
        lang: "bash",
        text: "npx @ballast/cli check\n# auto-detects prisma/migrations, db/migrate, drizzle/, and friends\n\n# or point it somewhere explicitly:\nnpx @ballast/cli check prisma/migrations",
      },
      {
        kind: "p",
        text: "Exit code 0 means safe by your policy; 1 means findings at or above the fail threshold; 2 means Ballast itself couldn't run (bad config, no files). The default policy fails only on blockers.",
      },
      { kind: "h2", text: "Add a config" },
      {
        kind: "code",
        lang: "bash",
        text: "npx @ballast/cli init",
      },
      {
        kind: "code",
        lang: "json",
        title: "ballast.config.json",
        text: '{\n  "preset": "prisma",\n  "pgVersion": 15,\n  "failOn": "blocker",\n  "rules": {\n    "no-drop-column": "blocker"\n  },\n  "ignore": ["prisma/migrations/0_init/**"]\n}',
      },
      {
        kind: "p",
        text: "The preset matters more than it looks: it tells Ballast whether your runner wraps migrations in a transaction, which changes what is safe. CREATE INDEX CONCURRENTLY fails inside a transaction — Ballast only flags it when your tool would actually put it in one.",
      },
      { kind: "h2", text: "Gate CI" },
      {
        kind: "code",
        lang: "yaml",
        title: ".github/workflows/ballast.yml",
        text: 'name: Migration safety\non:\n  pull_request:\n    paths:\n      - "**/migrations/**"\n      - "**/*.sql"\n\njobs:\n  ballast:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n      - run: npx @ballast/cli check --format github',
      },
      {
        kind: "p",
        text: "The github format emits workflow commands, so findings appear as inline annotations on the exact line of the migration in the PR diff.",
      },
      { kind: "h2", text: "Suppress deliberately" },
      {
        kind: "code",
        lang: "sql",
        text: "-- ballast-ignore: no-drop-table\n-- Decommissioned 2026-07, see RFC-114\nDROP TABLE legacy_events;",
      },
      {
        kind: "p",
        text: "Suppressions are inline, per-statement, and end up in code review — a paper trail instead of a silent bypass. `-- ballast-ignore` (no rule list) suppresses everything for one statement; `-- ballast-ignore-file` at the top of a file skips the file.",
      },
    ],
  },
  {
    slug: "how-it-works",
    title: "How the engine works",
    description:
      "A real SQL parser, transaction-semantics awareness, and false-positive suppression.",
    blocks: [
      {
        kind: "p",
        text: "Ballast is a deterministic static analyzer. No AI, no network calls, no telemetry — SQL in, findings out, the same answer every time.",
      },
      { kind: "h2", text: "Parsing" },
      {
        kind: "p",
        text: "Files are split into statements by a lexer that understands single quotes, double-quoted identifiers, dollar-quoted bodies, and nested block comments — then each statement is parsed into an AST. Statements the parser can't model (Postgres has a lot of syntax) fall back to normalized-text matching, so unsupported syntax degrades to still-checked rather than silently-passed.",
      },
      { kind: "h2", text: "Why presets exist" },
      {
        kind: "p",
        text: "The same statement can be safe under one migration tool and an outage under another. Prisma applies migration.sql without a wrapping transaction; Django and Rails wrap by default. That changes whether CREATE INDEX CONCURRENTLY is usable at all — so the engine models the runner, not just the SQL.",
      },
      {
        kind: "table",
        head: ["Preset", "Wraps in transaction", "Detected from"],
        rows: [
          ["prisma", "no", "prisma/migrations/**/migration.sql"],
          ["django", "yes (atomic by default)", "**/migrations/*.sql"],
          ["rails", "yes (disable_ddl_transaction! opts out)", "db/migrate/**"],
          ["drizzle", "yes", "drizzle/**"],
          ["flyway", "yes", "sql/**/V*.sql"],
          ["goose", "yes (NO TRANSACTION opts out)", "migrations/**"],
          ["golang-migrate", "no", "migrations/**/*.up.sql"],
        ],
      },
      { kind: "h2", text: "False-positive suppression" },
      {
        kind: "p",
        text: "The engine tracks tables created earlier in the same file. DDL against a table that doesn't exist yet cannot block traffic, so an initial migration that creates a table and then indexes it stays silent. This one behavior is most of the difference between a linter people keep and a linter people disable.",
      },
      { kind: "h2", text: "Scoring" },
      {
        kind: "p",
        text: "Each report gets a 0–100 safety score (blockers −25, warnings −10, notices −3) and a letter grade. The score is for humans and dashboards; CI gating uses the failOn threshold, not the score.",
      },
    ],
  },
  {
    slug: "rules",
    title: "Rules reference",
    description:
      "Every rule, its failure mode, and the safe alternative. Rendered from the engine's registry.",
    blocks: [],
  },
  {
    slug: "cloud",
    title: "Ballast Cloud",
    description: "History, team policy, PR annotations, and rehearsals.",
    blocks: [
      {
        kind: "p",
        text: "The CLI is complete without an account. Cloud adds the team layer: every check stored and diffable, org-wide rule policy, GitHub annotations posted by our app (no credentials wiring), and migration rehearsals.",
      },
      { kind: "h2", text: "Upload checks from CI" },
      {
        kind: "code",
        lang: "bash",
        text: "# Project settings → API keys → create\nexport BALLAST_API_KEY=blt_live_...\n\nnpx @ballast/cli check --upload",
      },
      {
        kind: "p",
        text: "Upload failures never fail your CI — the check's exit code depends only on the analysis. Branch, commit, and run URL are picked up from CI environment variables automatically.",
      },
      { kind: "h2", text: "REST in one request" },
      {
        kind: "code",
        lang: "bash",
        text: 'curl -s https://ballast.dev/api/v1/analyze \\\n  -H "content-type: application/json" \\\n  -d \'{"sql": "CREATE INDEX i ON users(email);", "config": {"preset": "prisma"}}\' | jq .summary',
      },
      {
        kind: "p",
        text: "The stateless analyze endpoint is public and rate-limited — it's what powers the playground. Authenticated endpoints are documented in the API reference.",
      },
    ],
  },
  {
    slug: "rehearsals",
    title: "Migration rehearsals",
    description:
      "Apply the migration to a production-shaped database before production does.",
    blocks: [
      {
        kind: "p",
        text: "Static analysis answers \"is this pattern dangerous?\". A rehearsal answers \"how long will this actually take?\" — by really executing the migration against a disposable database you point at production-shaped data.",
      },
      { kind: "h2", text: "How it runs" },
      {
        kind: "list",
        items: [
          "The worker creates an isolated schema on your rehearsal database (REHEARSAL_DATABASE_URL).",
          "Statements execute one at a time with a 30s lock_timeout and 15min statement_timeout.",
          "Per-statement wall-clock timings are recorded; failures capture the exact Postgres error.",
          "The schema is dropped afterwards — the rehearsal database is disposable by design.",
        ],
      },
      { kind: "h2", text: "Seeding a production-shaped database" },
      {
        kind: "p",
        text: "Rehearsals are only as honest as the data. Restore a scrubbed snapshot, or copy schema plus representative row counts. Timing a rewrite of 200M rows requires 200M rows — there is no shortcut, which is exactly why rehearsals catch what estimates miss.",
      },
      {
        kind: "code",
        lang: "bash",
        text: "# minimal: schema + synthetic volume\npg_dump --schema-only $PROD_URL | psql $REHEARSAL_URL\npsql $REHEARSAL_URL -c \"INSERT INTO users SELECT ... FROM generate_series(1, 200000000)\"",
      },
    ],
  },
  {
    slug: "self-hosting",
    title: "Self-hosting",
    description: "The whole cloud — dashboard, API, worker — from one compose file.",
    blocks: [
      {
        kind: "p",
        text: "Ballast Cloud's code lives in this repository. Self-hosting is a supported path, not a crippled demo: the same web app, API, and worker we run.",
      },
      { kind: "h2", text: "docker compose" },
      {
        kind: "code",
        lang: "bash",
        text: "git clone https://github.com/ballast-dev/ballast\ncd ballast\ncp .env.example .env   # fill in Clerk + Stripe keys (or leave Stripe off)\ndocker compose up --build",
      },
      {
        kind: "list",
        items: [
          "web — Next.js app on :3000 (marketing, dashboard, REST + GraphQL APIs)",
          "worker — check ingestion, rehearsals, retention sweeps (pg-boss on Postgres, no Redis)",
          "postgres — application database; pg-boss lives in a pgboss schema alongside",
        ],
      },
      { kind: "h2", text: "Environment" },
      {
        kind: "p",
        text: "Every variable is documented in .env.example. Clerk keys are required for the dashboard (the marketing site and public API run without them). Stripe keys are only needed if you're charging yourself, which would be a bold move.",
      },
      { kind: "h2", text: "Scaling notes" },
      {
        kind: "list",
        items: [
          "The analyze endpoint's rate limiter is in-memory; behind multiple replicas, back it with Postgres or Redis.",
          "Workers scale horizontally — pg-boss handles locking and retry semantics.",
          "Rehearsals want their own database instance; never point REHEARSAL_DATABASE_URL at production.",
        ],
      },
    ],
  },
  {
    slug: "api",
    title: "API reference",
    description: "REST and GraphQL, authenticated with project API keys.",
    blocks: [
      {
        kind: "p",
        text: "All authenticated endpoints take `Authorization: Bearer blt_live_…`. Keys are created per-project in the dashboard and shown once; we store only a SHA-256 hash.",
      },
      { kind: "h2", text: "POST /api/v1/analyze" },
      {
        kind: "p",
        text: "Stateless analysis. Public, rate-limited (30 req/min/IP), maximum 128 KB of SQL. Body: { sql, filename?, config? }. Returns the full report: findings with fixes, summary with score.",
      },
      { kind: "h2", text: "POST /api/v1/checks" },
      {
        kind: "p",
        text: "Store a check run for the key's project (the CLI's --upload calls this). Body: { report, meta? { branch, commit, repository, runUrl } }. Returns { id, url } with 201. Findings are expanded by the worker; the summary is queryable immediately.",
      },
      { kind: "h2", text: "GET /api/v1/checks and /api/v1/checks/:id" },
      {
        kind: "p",
        text: "List runs (cursor pagination: ?limit=20&cursor=<id>) or fetch one with findings. Runs belong to the key's project; cross-project access is impossible by construction.",
      },
      { kind: "h2", text: "POST /api/v1/rehearsals" },
      {
        kind: "p",
        text: "Queue a rehearsal: { sql, checkRunId? }. Returns 202 with { id }. Poll GET /api/v1/rehearsals/:id for status, timings, and errors.",
      },
      { kind: "h2", text: "GraphQL" },
      {
        kind: "code",
        lang: "graphql",
        text: "POST /api/graphql\n\nquery RecentFailures {\n  project {\n    name\n    checkRuns(first: 10) {\n      id\n      passed\n      score\n      findings { ruleId severity file line }\n    }\n  }\n}",
      },
      {
        kind: "p",
        text: "The GraphQL endpoint mirrors the REST data model for teams that prefer one query for dashboards. Same Bearer auth, same project scoping.",
      },
    ],
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}
