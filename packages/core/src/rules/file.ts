import type { FileRule } from "../types.js";
import { alterTableTarget, targetsNewTable } from "./util.js";

const SETS_LOCK_TIMEOUT = /^SET (?:LOCAL )?LOCK_TIMEOUT\b/;

export const requireLockTimeout: FileRule = {
  kind: "file",
  meta: {
    id: "require-lock-timeout",
    slug: "require-lock-timeout",
    title: "DDL without a lock_timeout can queue an outage",
    category: "operational",
    defaultSeverity: "notice",
    why:
      "Even an instant ALTER TABLE needs ACCESS EXCLUSIVE. If any " +
      "long-running query holds a lock on the table, your DDL waits — and " +
      "every new query queues behind your DDL. A one-second migration " +
      "becomes a site-wide stall behind one analytics query. Setting " +
      "lock_timeout makes the migration fail fast (and retryable) instead " +
      "of taking the site down.",
  },
  check(file, ctx) {
    const sets = file.statements.some((s) => SETS_LOCK_TIMEOUT.test(s.normalized));
    if (sets) return null;

    const takesLocks = file.statements.some((s) => {
      const n = s.normalized;
      if (/^ALTER TABLE /.test(n)) {
        return !targetsNewTable(ctx, alterTableTarget(n) ?? undefined);
      }
      // CONCURRENTLY variants take only SHARE UPDATE EXCLUSIVE — they do not
      // queue traffic behind an ACCESS EXCLUSIVE wait, so they don't count.
      if (/^CREATE (?:UNIQUE )?INDEX (?!CONCURRENTLY)/.test(n)) {
        const t = /\bON (?:ONLY )?("?[\w$.]+"?)/.exec(n);
        return !targetsNewTable(ctx, t?.[1]?.replace(/"/g, ""));
      }
      if (/^(DROP INDEX|REINDEX) /.test(n) && /\bCONCURRENTLY\b/.test(n)) {
        return false;
      }
      return /^(DROP INDEX|DROP TABLE|LOCK TABLE|REINDEX)\b/.test(n);
    });
    if (!takesLocks) return null;

    return {
      message:
        "This migration takes locks on existing tables but never sets lock_timeout — a blocked DDL here queues all traffic behind it.",
      line: 1,
      fix: {
        summary: "Fail fast instead of queueing an outage",
        sql: "SET lock_timeout = '5s';",
        steps: [
          "Put it at the top of the migration (SET LOCAL inside a transaction).",
          "Pair with retries in your deploy pipeline: a lock timeout is retryable; an outage is not.",
        ],
      },
    };
  },
};
