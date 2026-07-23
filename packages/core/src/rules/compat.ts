import type { RawFinding, StatementRule } from "../types.js";
import { alterTableTarget, qname, targetsNewTable } from "./util.js";

export const noRenameColumn: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-rename-column",
    slug: "no-rename-column",
    title: "Renaming a column breaks the running application",
    category: "compatibility",
    defaultSeverity: "warning",
    why:
      "During a rolling deploy, the previous application version keeps " +
      "running against the new schema. The moment the rename lands, every " +
      "query from the old version that references the old name starts " +
      "erroring — a partial outage that lasts until the deploy completes " +
      "(or worse, until a rollback that now also fails).",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (change.type === "rename column") {
          findings.push({
            message: `Renaming ${table}."${change.column.name}" → "${change.to.name}" breaks queries from the still-running previous release.`,
            fix: renameColumnFix(),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (/^ALTER TABLE [^;]*RENAME COLUMN/.test(stmt.normalized)) {
      return {
        message:
          "Renaming a column breaks queries from the still-running previous release.",
        fix: renameColumnFix(),
      };
    }
    return null;
  },
};

function renameColumnFix() {
  return {
    summary: "Use expand-and-contract instead of a rename",
    steps: [
      "Add the new column; dual-write to both from the application.",
      "Backfill old rows in batches; switch reads to the new column.",
      "Drop the old column in a later migration, after every consumer is updated.",
    ],
  };
}

export const noRenameTable: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-rename-table",
    slug: "no-rename-table",
    title: "Renaming a table breaks the running application",
    category: "compatibility",
    defaultSeverity: "warning",
    why:
      "The previous application version — still serving traffic during the " +
      "deploy — queries the old table name and starts failing instantly.",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (change.type === "rename") {
          findings.push({
            message: `Renaming table ${table} → "${change.to.name}" breaks the still-running previous release.`,
            fix: renameTableFix(table, change.to.name),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    const m = /^ALTER TABLE (?:IF EXISTS )?("?[\w$.]+"?) RENAME TO ("?[\w$]+"?)/.exec(
      stmt.normalized,
    );
    if (m && m[1] && m[2]) {
      const from = m[1].replace(/"/g, "");
      const to = m[2].replace(/"/g, "");
      return {
        message: `Renaming table ${from} → ${to} breaks the still-running previous release.`,
        fix: renameTableFix(from, to),
      };
    }
    return null;
  },
};

function renameTableFix(from: string, to: string) {
  return {
    summary: "Migrate via a compatibility view, or rename after code",
    steps: [
      `If you must rename now: CREATE VIEW ${from} AS SELECT * FROM ${to}; keeps the old release working, then drop the view once the deploy finishes.`,
      "Otherwise deploy code that reads the new name behind a flag first, rename, then clean up.",
    ],
  };
}

export const noDropColumn: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-drop-column",
    slug: "no-drop-column",
    title: "Dropping a column the running release may still use",
    category: "destructive",
    defaultSeverity: "warning",
    why:
      "If any still-running release (or a queued rollback target) selects " +
      "this column, its queries fail the instant the drop commits. The data " +
      "is also gone — DROP COLUMN is not transactionally reversible in any " +
      "useful way once traffic resumes.",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "alter table") return null;
      if (targetsNewTable(ctx, stmt.ast.table)) return null;
      const table = qname(stmt.ast.table);
      const findings: RawFinding[] = [];
      for (const change of stmt.ast.changes) {
        if (change.type === "drop column") {
          findings.push({
            message: `Dropping ${table}."${change.column.name}" — confirm no running release still reads or writes it.`,
            fix: dropColumnFix(),
          });
        }
      }
      return findings;
    }
    if (targetsNewTable(ctx, alterTableTarget(stmt.normalized) ?? undefined)) {
      return null;
    }
    if (/^ALTER TABLE [^;]*DROP COLUMN/.test(stmt.normalized)) {
      return {
        message:
          "Dropping a column — confirm no running release still reads or writes it.",
        fix: dropColumnFix(),
      };
    }
    return null;
  },
};

function dropColumnFix() {
  return {
    summary: "Drop only after the column is unreferenced everywhere",
    steps: [
      "Ship the release that stops referencing the column first; let it bake.",
      "ORMs that SELECT * by default (Active Record, some Django patterns) keep reading dropped columns — mark it ignored in the model first.",
      "Then drop in its own migration, with a lock_timeout set.",
    ],
  };
}

export const noDropTable: StatementRule = {
  kind: "statement",
  meta: {
    id: "no-drop-table",
    slug: "no-drop-table",
    title: "DROP TABLE is irreversible in production",
    category: "destructive",
    defaultSeverity: "blocker",
    why:
      "Dropping a table destroys its data with no transactional undo once " +
      "the migration commits. If any code path still touches it, that path " +
      "hard-fails. Ballast blocks this by default so it is always a " +
      "deliberate, reviewed decision (suppress with -- ballast-ignore when it is).",
  },
  check(stmt, ctx) {
    if (stmt.ast) {
      if (stmt.ast.type !== "drop table") return null;
      const names = stmt.ast.names.map((n) => qname(n));
      if (names.every((n) => targetsNewTable(ctx, n))) return null;
      return {
        message: `DROP TABLE ${names.join(", ")} permanently destroys data and breaks any code still using it.`,
        fix: dropTableFix(),
      };
    }
    if (/^DROP TABLE/.test(stmt.normalized)) {
      return {
        message:
          "DROP TABLE permanently destroys data and breaks any code still using it.",
        fix: dropTableFix(),
      };
    }
    return null;
  },
};

function dropTableFix() {
  return {
    summary: "Soft-decommission before dropping",
    steps: [
      "Rename to a quarantine name (e.g. users_deprecated_20260722) or revoke access, and watch error rates for a release cycle.",
      "Take a final backup/snapshot of the table.",
      "Drop in a dedicated migration with -- ballast-ignore: no-drop-table and a link to the decision.",
    ],
  };
}
