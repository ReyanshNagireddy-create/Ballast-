import type { RawFinding, StatementRule } from "../types.js";
import { alterTableTarget, qname, targetsNewTable } from "./util.js";

export const requireNotValidForeignKey: StatementRule = {
  kind: "statement",
  meta: {
    id: "require-not-valid-foreign-key",
    slug: "require-not-valid-foreign-key",
    title: "Adding a foreign key without NOT VALID locks both tables",
    category: "locking",
    defaultSeverity: "warning",
    why:
      "ADD CONSTRAINT … FOREIGN KEY validates every existing row while " +
      "holding SHARE ROW EXCLUSIVE on both the referencing and the " +
      "referenced table — writes block on both for the whole scan. With " +
      "NOT VALID, the constraint applies to new rows instantly; a separate " +
      "VALIDATE CONSTRAINT then scans with a much weaker lock.",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      // If the parser accepted it, there is no NOT VALID clause (the parser
      // does not support one) — so an FK here is always unvalidated-unsafe.
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (
          change.type === "add constraint" &&
          change.constraint.type === "foreign key"
        ) {
          findings.push({
            message: `Foreign key on ${table} validates all rows under SHARE ROW EXCLUSIVE on both tables.`,
            fix: fkFix(stmt.sql),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (
      /ADD CONSTRAINT [^;]*FOREIGN KEY/.test(stmt.normalized) &&
      !/NOT VALID/.test(stmt.normalized)
    ) {
      return {
        message:
          "Foreign key validates all existing rows under SHARE ROW EXCLUSIVE on both tables.",
        fix: fkFix(stmt.sql),
      };
    }
    return null;
  },
};

function fkFix(sql: string) {
  return {
    summary: "Add the constraint NOT VALID, then validate separately",
    sql: `${sql.trim()} NOT VALID`,
    steps: [
      "Then, in a follow-up statement (or migration): ALTER TABLE … VALIDATE CONSTRAINT …;",
      "VALIDATE takes only SHARE UPDATE EXCLUSIVE — reads and writes continue.",
    ],
  };
}

export const requireNotValidCheck: StatementRule = {
  kind: "statement",
  meta: {
    id: "require-not-valid-check",
    slug: "require-not-valid-check",
    title: "Adding a CHECK constraint scans the table under lock",
    category: "locking",
    defaultSeverity: "warning",
    why:
      "ADD CONSTRAINT … CHECK verifies every existing row while holding " +
      "ACCESS EXCLUSIVE. NOT VALID makes the add instant; VALIDATE " +
      "CONSTRAINT afterwards scans without blocking writes.",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (
          change.type === "add constraint" &&
          change.constraint.type === "check"
        ) {
          findings.push({
            message: `CHECK constraint on ${table} scans all rows under ACCESS EXCLUSIVE.`,
            fix: checkFix(stmt.sql),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (
      /ADD CONSTRAINT [^;]*\bCHECK\b/.test(stmt.normalized) &&
      !/NOT VALID/.test(stmt.normalized) &&
      !/FOREIGN KEY/.test(stmt.normalized)
    ) {
      return {
        message:
          "CHECK constraint scans all existing rows under ACCESS EXCLUSIVE.",
        fix: checkFix(stmt.sql),
      };
    }
    return null;
  },
};

function checkFix(sql: string) {
  return {
    summary: "Add the constraint NOT VALID, then validate separately",
    sql: `${sql.trim()} NOT VALID`,
    steps: [
      "Then: ALTER TABLE … VALIDATE CONSTRAINT …; — scans with SHARE UPDATE EXCLUSIVE only.",
    ],
  };
}

export const noBlockingUniqueConstraint: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-blocking-unique-constraint",
    slug: "no-blocking-unique-constraint",
    title: "ADD UNIQUE/PRIMARY KEY builds an index under exclusive lock",
    category: "locking",
    defaultSeverity: "blocker",
    why:
      "ALTER TABLE … ADD CONSTRAINT UNIQUE (or PRIMARY KEY) builds the " +
      "backing index while holding ACCESS EXCLUSIVE on the table — reads " +
      "and writes block for the entire build. The safe path is to build a " +
      "unique index CONCURRENTLY first, then attach it with USING INDEX.",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (
          change.type === "add constraint" &&
          (change.constraint.type === "unique" ||
            change.constraint.type === "primary key")
        ) {
          findings.push({
            message: `${change.constraint.type.toUpperCase()} constraint on ${table} builds its index under ACCESS EXCLUSIVE.`,
            fix: uniqueFix(table),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (
      /ADD CONSTRAINT [^;]*\b(UNIQUE|PRIMARY KEY)\b/.test(stmt.normalized) &&
      !/USING INDEX/.test(stmt.normalized)
    ) {
      return {
        message:
          "UNIQUE/PRIMARY KEY constraint builds its index under ACCESS EXCLUSIVE.",
        fix: uniqueFix("t"),
      };
    }
    return null;
  },
};

function uniqueFix(table: string) {
  return {
    summary: "Build the index concurrently, then attach it",
    steps: [
      `CREATE UNIQUE INDEX CONCURRENTLY ${table}_key_idx ON ${table} (col);`,
      `ALTER TABLE ${table} ADD CONSTRAINT ${table}_key UNIQUE USING INDEX ${table}_key_idx;  -- brief lock, no build`,
    ],
  };
}
