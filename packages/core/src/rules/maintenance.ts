import type { RawFinding, StatementRule } from "../types.js";
import { qname } from "./util.js";

export const noBlockingMaintenance: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-blocking-maintenance",
    slug: "no-blocking-maintenance",
    title: "Blocking maintenance command in a migration",
    category: "locking",
    defaultSeverity: "blocker",
    why:
      "VACUUM FULL, CLUSTER, REINDEX (non-concurrent), REFRESH MATERIALIZED " +
      "VIEW (non-concurrent) and explicit LOCK TABLE hold locks that stop " +
      "reads and/or writes for their entire — often long — runtime. None of " +
      "them belong in a deploy-time migration.",
  },
  check(stmt) {
    const n = stmt.normalized;
    if (stmt.ast?.type === "refresh materialized view") {
      if (stmt.ast.concurrently) return null;
      return {
        message: `REFRESH MATERIALIZED VIEW ${qname(stmt.ast.name)} without CONCURRENTLY blocks all reads of the view while it rebuilds.`,
        fix: {
          summary: "Refresh concurrently",
          sql: stmt.sql.replace(
            /^(\s*REFRESH\s+MATERIALIZED\s+VIEW)\s+/i,
            "$1 CONCURRENTLY ",
          ),
          steps: [
            "Requires a unique index on the materialized view.",
            "Prefer refreshing from a scheduled job, not a migration.",
          ],
        },
      };
    }
    const cases: Array<[RegExp, string, string]> = [
      [
        /^VACUUM FULL\b/,
        "VACUUM FULL rewrites the entire table under ACCESS EXCLUSIVE — full read/write outage for the table.",
        "Use plain VACUUM (or autovacuum tuning); for bloat recovery use pg_repack, which works online.",
      ],
      [
        /^CLUSTER\b/,
        "CLUSTER rewrites the table under ACCESS EXCLUSIVE — full read/write outage for the table.",
        "Use pg_repack to re-cluster online, outside of migrations.",
      ],
      [
        /^REINDEX (?!.*CONCURRENTLY)/,
        "REINDEX without CONCURRENTLY blocks writes (and reads for the index) while rebuilding.",
        "Use REINDEX CONCURRENTLY (PG 12+), or create a replacement index CONCURRENTLY and drop the old one.",
      ],
      [
        /^REFRESH MATERIALIZED VIEW (?!CONCURRENTLY)/,
        "REFRESH MATERIALIZED VIEW without CONCURRENTLY blocks all reads of the view while it rebuilds.",
        "Add CONCURRENTLY (requires a unique index on the view) and run it from a job, not a migration.",
      ],
      [
        /^LOCK TABLE\b/,
        "Explicit LOCK TABLE defaults to ACCESS EXCLUSIVE — it stops all traffic to the table until commit.",
        "Remove the explicit lock; rely on the weakest lock the DDL itself needs, with a lock_timeout.",
      ],
    ];
    for (const [re, message, fix] of cases) {
      if (re.test(n)) {
        return { message, fix: { summary: fix } };
      }
    }
    return null;
  },
};

export const noDestructiveData: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-destructive-data-statement",
    slug: "no-destructive-data-statement",
    title: "Unbounded destructive data statement in a migration",
    category: "destructive",
    defaultSeverity: "warning",
    why:
      "TRUNCATE, or DELETE/UPDATE with no WHERE clause, touches every row. " +
      "Beyond the data loss risk, a full-table UPDATE/DELETE in a migration " +
      "bloats the table, blocks concurrent writers row-by-row, and can hold " +
      "a transaction open long enough to stall vacuum and replication.",
  },
  check(stmt) {
    if (stmt.ast) {
      if (stmt.ast.type === "truncate table") {
        return {
          message: `TRUNCATE ${stmt.ast.tables.map((t) => qname(t)).join(", ")} irreversibly deletes all rows and takes ACCESS EXCLUSIVE.`,
          fix: {
            summary: "Move destructive cleanup out of deploy-time migrations",
            steps: [
              "If intended, run it as a supervised operational task with a backup taken first.",
              "Suppress deliberately with -- ballast-ignore: no-destructive-data-statement.",
            ],
          },
        };
      }
      if (stmt.ast.type === "delete" && !stmt.ast.where) {
        return unboundedDml("DELETE");
      }
      if (stmt.ast.type === "update" && !stmt.ast.where) {
        return unboundedDml("UPDATE");
      }
      return null;
    }
    const n = stmt.normalized;
    if (/^TRUNCATE\b/.test(n)) {
      return {
        message:
          "TRUNCATE irreversibly deletes all rows and takes ACCESS EXCLUSIVE.",
        fix: {
          summary: "Move destructive cleanup out of deploy-time migrations",
        },
      };
    }
    if (/^DELETE FROM\b/.test(n) && !/\bWHERE\b/.test(n)) {
      return unboundedDml("DELETE");
    }
    if (/^UPDATE\b/.test(n) && !/\bWHERE\b/.test(n)) {
      return unboundedDml("UPDATE");
    }
    return null;
  },
};

function unboundedDml(kind: "DELETE" | "UPDATE"): RawFinding {
  return {
    message: `${kind} with no WHERE clause touches every row — long lock churn, table bloat, and replication lag in one statement.`,
    fix: {
      summary: "Batch it, bound it, or move it out of the migration",
      steps: [
        `Run the ${kind} in bounded batches (WHERE id BETWEEN … LIMIT-style loops) from a job or script.`,
        "If the full-table operation is intended, suppress with -- ballast-ignore: no-destructive-data-statement.",
      ],
    },
  };
}

export const noEnumAddValueInTransaction: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-enum-add-value-in-transaction",
    slug: "no-enum-add-value-in-transaction",
    title: "ALTER TYPE … ADD VALUE fails inside a transaction (PG < 12)",
    category: "operational",
    defaultSeverity: "warning",
    why:
      "Before Postgres 12, ALTER TYPE … ADD VALUE cannot run inside a " +
      "transaction block. Migration runners that wrap files in a " +
      "transaction (Django, Rails, Flyway by default) fail at deploy time " +
      "with ERROR 25001.",
  },
  check(stmt, ctx) {
    if (ctx.config.pgVersion >= 12) return null;
    if (!stmt.inTransaction) return null;
    if (!/^ALTER TYPE [^;]*ADD VALUE/.test(stmt.normalized)) return null;
    return {
      message:
        "ALTER TYPE … ADD VALUE inside a transaction fails on Postgres < 12.",
      fix: {
        summary: "Run outside a transaction, or upgrade Postgres",
        steps: [
          "Django: atomic = False; Rails: disable_ddl_transaction!.",
          "On Postgres 12+ this statement is transaction-safe (the new value is just unusable until commit).",
        ],
      },
    };
  },
};
