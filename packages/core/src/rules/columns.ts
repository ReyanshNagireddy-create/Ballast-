import type { AlterTableStatement, TableAlterationAddColumn } from "pgsql-ast-parser";
import type { RawFinding, StatementRule } from "../types.js";
import {
  alterTableTarget,
  findVolatileCall,
  qname,
  targetsNewTable,
} from "./util.js";

function eachAddColumn(
  ast: AlterTableStatement,
  fn: (change: TableAlterationAddColumn) => void,
): void {
  for (const change of ast.changes) {
    if (change.type === "add column") fn(change);
  }
}

export const noAddColumnNotNullNoDefault: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-not-null-column-without-default",
    slug: "no-not-null-column-without-default",
    title: "Adding a NOT NULL column without a DEFAULT fails on data",
    category: "operational",
    defaultSeverity: "blocker",
    why:
      "Adding a NOT NULL column with no DEFAULT errors immediately on any " +
      "table that already has rows — existing rows would violate the " +
      "constraint. The migration fails at deploy time, in production, on " +
      "exactly the tables that matter.",
  },
  check(stmt, ctx) {
    const findings: RawFinding[] = [];
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      eachAddColumn(stmt.ast, (change) => {
        const constraints = change.column.constraints ?? [];
        const notNull = constraints.some((c) => c.type === "not null");
        const hasDefault = constraints.some((c) => c.type === "default");
        const generated = constraints.some((c) => c.type === "add generated");
        if (notNull && !hasDefault && !generated) {
          findings.push({
            message: `Column "${change.column.name.name}" on ${table} is NOT NULL with no DEFAULT — this fails if the table has any rows.`,
            fix: {
              summary: "Add the column with a DEFAULT, or in phases",
              steps: [
                "Option A (Postgres 11+): add the column with NOT NULL and a DEFAULT — this is metadata-only and instant.",
                "Option B: add the column nullable, backfill in batches, add a CHECK (col IS NOT NULL) NOT VALID, VALIDATE it, then SET NOT NULL (instant on PG 12+ once the CHECK is valid).",
              ],
            },
          });
        }
      });
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (
      /ADD COLUMN (?:IF NOT EXISTS )?[^;]*\bNOT NULL\b/.test(stmt.normalized) &&
      !/\bDEFAULT\b/.test(stmt.normalized) &&
      !/\bGENERATED\b/.test(stmt.normalized)
    ) {
      return {
        message:
          "Adding a NOT NULL column with no DEFAULT — this fails if the table has any rows.",
        fix: {
          summary: "Add the column with a DEFAULT, or in phases",
          steps: [
            "Option A (Postgres 11+): add the column with NOT NULL and a DEFAULT — metadata-only and instant.",
            "Option B: add nullable, backfill in batches, then enforce NOT NULL via a validated CHECK constraint.",
          ],
        },
      };
    }
    return null;
  },
};

export const noVolatileDefault: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-volatile-default",
    slug: "no-volatile-default",
    title: "Volatile DEFAULT on a new column rewrites the whole table",
    category: "rewrite",
    defaultSeverity: "warning",
    why:
      "Since Postgres 11, ADD COLUMN with a constant DEFAULT is metadata-only. " +
      "But a volatile default — gen_random_uuid(), random(), clock_timestamp() — " +
      "must be evaluated per row, forcing a full table rewrite under an " +
      "ACCESS EXCLUSIVE lock. Reads and writes block for the whole rewrite.",
  },
  check(stmt, ctx) {
    const volatileRe =
      /ADD COLUMN [^;]*DEFAULT [^;]*\b(RANDOM|GEN_RANDOM_UUID|UUID_GENERATE_V1|UUID_GENERATE_V4|CLOCK_TIMESTAMP|TIMEOFDAY|TXID_CURRENT|NEXTVAL)\s*\(/;
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      eachAddColumn(stmt.ast, (change) => {
        for (const c of change.column.constraints ?? []) {
          if (c.type !== "default") continue;
          const fn = findVolatileCall(c.default);
          if (fn) {
            findings.push({
              message: `DEFAULT ${fn}() on new column "${change.column.name.name}" forces a full rewrite of ${table} under ACCESS EXCLUSIVE.`,
              fix: volatileFix(),
            });
          }
        }
      });
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (volatileRe.test(stmt.normalized)) {
      return {
        message:
          "Volatile DEFAULT on a new column forces a full table rewrite under ACCESS EXCLUSIVE.",
        fix: volatileFix(),
      };
    }
    return null;
  },
};

function volatileFix() {
  return {
    summary: "Add the column without the volatile default, then backfill",
    steps: [
      "Add the column with no DEFAULT (or a constant placeholder).",
      "Set the DEFAULT afterwards — ALTER COLUMN SET DEFAULT only affects future rows and is instant.",
      "Backfill existing rows in batches (UPDATE … WHERE id BETWEEN …).",
    ],
  };
}

export const noColumnTypeChange: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-column-type-change",
    slug: "no-column-type-change",
    title: "Changing a column's type rewrites the table under lock",
    category: "rewrite",
    defaultSeverity: "blocker",
    why:
      "ALTER COLUMN … TYPE generally rewrites every row of the table while " +
      "holding ACCESS EXCLUSIVE — no reads, no writes, for the entire " +
      "rewrite. It worked in staging because staging has 10k rows; " +
      "production has 300M. (A few conversions are exempt from the rewrite: " +
      "widening varchar(n), varchar→text, raising numeric precision.)",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (change.type === "alter column" && change.alter.type === "set type") {
          findings.push({
            message: `Type change of "${change.column.name}" on ${table} likely rewrites the whole table under ACCESS EXCLUSIVE.`,
            fix: typeChangeFix(),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (/ALTER COLUMN [^;]*\b(SET DATA TYPE|TYPE)\b/.test(stmt.normalized)) {
      return {
        message:
          "Column type change likely rewrites the whole table under ACCESS EXCLUSIVE.",
        fix: typeChangeFix(),
      };
    }
    return null;
  },
};

function typeChangeFix() {
  return {
    summary: "Use expand-and-contract instead of an in-place type change",
    steps: [
      "Add a new column with the target type.",
      "Dual-write from the application (or a trigger) and backfill old rows in batches.",
      "Swap reads to the new column, then drop the old one in a later migration.",
      "Exceptions that skip the rewrite (safe to keep in place): varchar(n)→varchar(m>n), varchar(n)→text, numeric(p,s)→numeric(p+,s).",
    ],
  };
}

export const noSetNotNull: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-set-not-null-on-existing-column",
    slug: "no-set-not-null-on-existing-column",
    title: "SET NOT NULL scans the whole table under an exclusive lock",
    category: "locking",
    defaultSeverity: "warning",
    why:
      "ALTER COLUMN … SET NOT NULL must verify every existing row while " +
      "holding ACCESS EXCLUSIVE. On Postgres 12+ there is a safe path: if a " +
      "validated CHECK (col IS NOT NULL) constraint already exists, " +
      "SET NOT NULL skips the scan entirely.",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (
          change.type === "alter column" &&
          change.alter.type === "set not null"
        ) {
          findings.push({
            message: `SET NOT NULL on ${table}."${change.column.name}" scans the full table under ACCESS EXCLUSIVE.`,
            fix: setNotNullFix(),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (/ALTER COLUMN [^;]*SET NOT NULL/.test(stmt.normalized)) {
      return {
        message:
          "SET NOT NULL scans the full table under ACCESS EXCLUSIVE.",
        fix: setNotNullFix(),
      };
    }
    return null;
  },
};

function setNotNullFix() {
  return {
    summary: "Validate via a CHECK constraint first (instant on PG 12+)",
    steps: [
      "ALTER TABLE t ADD CONSTRAINT t_col_not_null CHECK (col IS NOT NULL) NOT VALID;",
      "ALTER TABLE t VALIDATE CONSTRAINT t_col_not_null;  -- takes only SHARE UPDATE EXCLUSIVE",
      "ALTER TABLE t ALTER COLUMN col SET NOT NULL;  -- skips the scan, PG 12+",
      "ALTER TABLE t DROP CONSTRAINT t_col_not_null;",
    ],
  };
}
