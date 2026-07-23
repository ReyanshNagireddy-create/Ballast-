import type { DocBlock } from "./docs-content";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  role: string;
  blocks: DocBlock[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "introducing-ballast",
    title: "Introducing Ballast: the safety layer for Postgres migrations",
    description:
      "Your ORM writes correct DDL with zero commentary on lock behavior. Ballast is the CI layer that adds the commentary — and the gate.",
    date: "2026-07-22",
    author: "The Ballast team",
    role: "",
    blocks: [
      {
        kind: "p",
        text: "Every team running Postgres has a version of this story. A migration sails through review — it's four lines, it's obviously fine. It runs instantly in staging. Then it hits production, where the table has two hundred million rows and live traffic, and suddenly writes are blocked, the connection pool is full, and someone is typing 'incident' into Slack.",
      },
      {
        kind: "p",
        text: "The frustrating part: the dangerous patterns are finite and known. CREATE INDEX without CONCURRENTLY blocks writes for the build. ALTER COLUMN TYPE rewrites the table under ACCESS EXCLUSIVE. An un-NOT VALID foreign key scans and locks two tables. This knowledge lives in postmortems, conference talks, and the heads of people who've been burned — everywhere except the one place it would help: your CI pipeline.",
      },
      { kind: "h2", text: "What Ballast is" },
      {
        kind: "p",
        text: "Ballast is a deterministic static analyzer for migration SQL, wired into CI. It parses every migration in a PR, checks it against 18 rules encoding how Postgres locking actually behaves, and fails the check with the exact line, the failure mode, and the safe rewrite. It works with the migrations you already have — Prisma, Django, Rails, Drizzle, Flyway, goose, golang-migrate, or plain SQL. You adopt nothing. You rewrite nothing.",
      },
      {
        kind: "code",
        lang: "bash",
        text: "npx @ballast/cli check\n# 1 file, 2 statements analyzed\n# [BLOCKER] require-concurrent-index-creation migration.sql:2\n#   Index build on users will block all writes for its full duration.\n#   fix: CREATE INDEX CONCURRENTLY users_plan_idx ON users (plan)",
      },
      { kind: "h2", text: "What makes it different" },
      {
        kind: "list",
        items: [
          "It models your migration runner, not just SQL. CREATE INDEX CONCURRENTLY inside a transaction is an error — whether it's in one depends on whether you use Prisma (no wrapping transaction) or Django (atomic by default). Ballast knows.",
          "It suppresses the false positives that kill linters. DDL on a table created in the same file can't block traffic; Ballast stays quiet about it.",
          "Every finding teaches. The 'why' is a paragraph about lock queues and rewrites, not a rule code — the tool trains reviewers as it gates.",
          "The engine is Apache-2.0, forever. Safety tooling you can't audit is a contradiction.",
        ],
      },
      { kind: "h2", text: "And Ballast Cloud" },
      {
        kind: "p",
        text: "For teams, the cloud adds what a CLI can't: check history across every repo, org-wide policy, PR annotations posted by our GitHub App, and rehearsals — your migration applied to a disposable production-shaped database first, with real per-statement timings. Flat $99/month for the whole org, because per-seat pricing for safety tooling punishes you for adding the people who most need to see it.",
      },
      {
        kind: "p",
        text: "Try the playground with your scariest recent migration. We think you'll find something.",
      },
    ],
  },
  {
    slug: "the-lock-queue-is-the-outage",
    title: "The lock queue is the outage",
    description:
      "The deadliest Postgres migration failure isn't the slow DDL — it's the fast DDL stuck in a queue, with your whole app queued behind it.",
    date: "2026-07-15",
    author: "The Ballast team",
    role: "",
    blocks: [
      {
        kind: "p",
        text: "Ask an engineer why migrations cause downtime and they'll usually say 'long locks' — some ALTER rewriting a huge table. That happens. But the failure that takes down healthy apps with innocent-looking one-line migrations is subtler, and it's worth understanding precisely, because the fix is one line.",
      },
      { kind: "h2", text: "The mechanics" },
      {
        kind: "p",
        text: "Nearly every ALTER TABLE needs an ACCESS EXCLUSIVE lock — even ones that finish in milliseconds, like adding a nullable column. ACCESS EXCLUSIVE conflicts with everything, including the ACCESS SHARE locks that plain SELECTs take.",
      },
      {
        kind: "p",
        text: "Now suppose an analytics query has been reading your users table for four minutes when your migration arrives. Your ALTER can't get its lock, so it waits. Fine — waiting is free, right? No. Postgres lock queues are fair: every query that arrives after your ALTER queues behind it. Every SELECT. Every INSERT. Your entire application's traffic to that table, parked behind a migration that is itself parked behind one analytics query.",
      },
      {
        kind: "code",
        lang: "text",
        text: "analytics SELECT (running, 4 min)   ← holds ACCESS SHARE\n  └─ ALTER TABLE users ...          ← waits for ACCESS EXCLUSIVE\n       └─ every subsequent query    ← waits behind the ALTER\n            └─ connection pool fills\n                 └─ the pager goes off",
      },
      {
        kind: "p",
        text: "From the outside this looks like the database 'locking up'. Nothing is stuck — everything is politely queueing. A one-second migration became an outage whose duration is set by your longest-running query.",
      },
      { kind: "h2", text: "The one-line fix" },
      {
        kind: "code",
        lang: "sql",
        text: "SET lock_timeout = '5s';\nALTER TABLE users ADD COLUMN plan text;",
      },
      {
        kind: "p",
        text: "With a lock_timeout, the ALTER gives up after five seconds instead of queueing traffic indefinitely. The migration fails — which sounds bad until you compare the alternatives: a retryable failed deploy versus a site-wide stall. Pair it with retries in your deploy pipeline and the failure mode becomes 'migration retried at 02:14, succeeded' instead of a postmortem.",
      },
      { kind: "h2", text: "Why this belongs in CI" },
      {
        kind: "p",
        text: "This is exactly the kind of knowledge that shouldn't depend on who reviews your PR. Ballast's require-lock-timeout rule notices any migration that takes locks on existing tables without setting one, and its other rules catch the heavier cousins — the non-concurrent index builds and table rewrites where the lock isn't just queued, it's held for the duration. The queue, not the query, is what takes you down. Gate for it.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
