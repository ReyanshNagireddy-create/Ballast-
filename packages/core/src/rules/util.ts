import type { QName } from "pgsql-ast-parser";
import type { AnalyzeContext, SqlStatement } from "../types.js";

export function qname(q: QName): string {
  return q.schema ? `${q.schema}.${q.name}` : q.name;
}

/** True when the statement targets a table created earlier in the same file. */
export function targetsNewTable(
  ctx: AnalyzeContext,
  table: string | QName | undefined,
): boolean {
  if (!table) return false;
  const name = typeof table === "string" ? table : qname(table);
  const bare = name.includes(".") ? name.slice(name.indexOf(".") + 1) : name;
  return (
    ctx.createdTables.has(name.toLowerCase()) ||
    ctx.createdTables.has(bare.toLowerCase())
  );
}

const ALTER_TABLE_RE =
  /^ALTER TABLE (?:IF EXISTS )?(?:ONLY )?("?[\w$]+"?(?:\."?[\w$]+"?)?)/;

/** Extracts the target table from a normalized ALTER TABLE statement. */
export function alterTableTarget(normalized: string): string | null {
  const m = ALTER_TABLE_RE.exec(normalized);
  if (!m || !m[1]) return null;
  return m[1].replace(/"/g, "");
}

export function isAlterTable(stmt: SqlStatement): boolean {
  return stmt.normalized.startsWith("ALTER TABLE ");
}

export function truncateSql(sql: string, max = 200): string {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** Functions whose use in a column DEFAULT forces a full table rewrite (volatile). */
export const VOLATILE_FUNCTIONS = new Set([
  "random",
  "gen_random_uuid",
  "uuid_generate_v1",
  "uuid_generate_v4",
  "clock_timestamp",
  "timeofday",
  "txid_current",
  "nextval",
]);

/** Recursively finds volatile function calls anywhere in an expression AST. */
export function findVolatileCall(node: unknown): string | null {
  if (node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findVolatileCall(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (obj.type === "call") {
    const fn = obj.function as { name?: string } | undefined;
    const name = fn?.name?.toLowerCase();
    if (name && VOLATILE_FUNCTIONS.has(name)) return name;
  }
  for (const key of Object.keys(obj)) {
    if (key === "_location") continue;
    const hit = findVolatileCall(obj[key]);
    if (hit) return hit;
  }
  return null;
}
