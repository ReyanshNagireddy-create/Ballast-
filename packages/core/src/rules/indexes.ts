import type { StatementRule } from "../types.js";
import { qname, targetsNewTable } from "./util.js";

export const requireConcurrentIndexCreation: StatementRule = {
  kind: "statement",
  meta: {
    id: "require-concurrent-index-creation",
    slug: "require-concurrent-index-creation",
    title: "CREATE INDEX without CONCURRENTLY blocks writes",
    category: "locking",
    defaultSeverity: "blocker",
    why:
      "A plain CREATE INDEX takes a SHARE lock on the table for the entire " +
      "build. Every INSERT, UPDATE, and DELETE blocks until it finishes — " +
      "on a large table that is minutes of write downtime. " +
      "CREATE INDEX CONCURRENTLY builds the index without blocking writes.",
  },
  check(stmt, ctx) {
    let table: string | null = null;
    if (stmt.ast) {
      if (stmt.ast.type !== "create index" || stmt.ast.concurrently) return null;
      table = qname(stmt.ast.table);
    } else {
      const m = /^CREATE (?:UNIQUE )?INDEX (?!CONCURRENTLY)/.exec(
        stmt.normalized,
      );
      if (!m) return null;
      const t = /\bON (?:ONLY )?("?[\w$.]+"?)/.exec(stmt.normalized);
      table = t?.[1]?.replace(/"/g, "") ?? null;
    }
    if (targetsNewTable(ctx, table ?? undefined)) return null;
    return {
      message: `Index build on ${table ?? "an existing table"} will block all writes for its full duration.`,
      fix: {
        summary: "Create the index concurrently",
        sql: stmt.sql.replace(
          /^(\s*CREATE\s+(?:UNIQUE\s+)?INDEX)\s+/i,
          "$1 CONCURRENTLY ",
        ),
        steps: [
          "CREATE INDEX CONCURRENTLY cannot run inside a transaction block — configure your migration runner accordingly (Prisma: works as-is; Django: atomic = False; Rails: disable_ddl_transaction!).",
          "If a concurrent build fails it leaves an INVALID index behind; drop it and retry.",
        ],
      },
    };
  },
};

export const requireConcurrentIndexDrop: StatementRule = {
  kind: "statement",
  meta: {
    id: "require-concurrent-index-drop",
    slug: "require-concurrent-index-drop",
    title: "DROP INDEX without CONCURRENTLY takes an exclusive lock",
    category: "locking",
    defaultSeverity: "warning",
    why:
      "DROP INDEX takes an ACCESS EXCLUSIVE lock on the parent table — it " +
      "blocks reads and writes while it waits for and holds the lock. " +
      "DROP INDEX CONCURRENTLY waits for in-flight queries without blocking new ones.",
  },
  check(stmt) {
    let indexName: string | null = null;
    if (stmt.ast) {
      if (stmt.ast.type !== "drop index" || stmt.ast.concurrently) return null;
      indexName = stmt.ast.names.map((n) => qname(n)).join(", ");
    } else {
      if (!/^DROP INDEX (?!CONCURRENTLY)/.test(stmt.normalized)) return null;
      const m = /^DROP INDEX (?:IF EXISTS )?("?[\w$.]+"?)/.exec(stmt.normalized);
      indexName = m?.[1]?.replace(/"/g, "") ?? null;
    }
    return {
      message: `Dropping index ${indexName ?? ""} holds ACCESS EXCLUSIVE on its table, blocking reads and writes.`.replace(
        "  ",
        " ",
      ),
      fix: {
        summary: "Drop the index concurrently",
        sql: stmt.sql.replace(/^(\s*DROP\s+INDEX)\s+/i, "$1 CONCURRENTLY "),
        steps: [
          "DROP INDEX CONCURRENTLY cannot run inside a transaction block.",
        ],
      },
    };
  },
};

export const noConcurrentIndexInTransaction: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-concurrent-index-in-transaction",
    slug: "no-concurrent-index-in-transaction",
    title: "CONCURRENTLY cannot run inside a transaction",
    category: "operational",
    defaultSeverity: "blocker",
    why:
      "CREATE/DROP INDEX CONCURRENTLY manages its own transactions and " +
      "Postgres rejects it inside a transaction block. Your migration will " +
      "fail at deploy time — and depending on the runner, leave the " +
      "migration half-applied.",
  },
  check(stmt) {
    if (!stmt.inTransaction) return null;
    const isConcurrent =
      /^CREATE (?:UNIQUE )?INDEX CONCURRENTLY/.test(stmt.normalized) ||
      /^DROP INDEX CONCURRENTLY/.test(stmt.normalized) ||
      /^REINDEX .*CONCURRENTLY/.test(stmt.normalized);
    if (!isConcurrent) return null;
    return {
      message:
        "This statement runs inside a transaction (runner-wrapped or explicit BEGIN) and will fail with ERROR 25001.",
      fix: {
        summary: "Run this migration outside a transaction",
        steps: [
          "Prisma: statements run without a wrapping transaction — remove any explicit BEGIN/COMMIT in this file.",
          "Django: set atomic = False on the migration.",
          "Rails: call disable_ddl_transaction! in the migration class.",
          "goose: use -- +goose NO TRANSACTION.",
        ],
      },
    };
  },
};
