import { parse, type Statement } from "pgsql-ast-parser";

/**
 * Attempts to parse a single SQL statement. Returns null when the statement
 * uses syntax pgsql-ast-parser does not support (e.g. `NOT VALID`,
 * `VALIDATE CONSTRAINT`, `VACUUM`, `LOCK TABLE`). Rules fall back to
 * normalized-text matching in that case, so unsupported syntax degrades
 * gracefully instead of silently passing.
 */
export function tryParseStatement(sql: string): Statement | null {
  try {
    const parsed = parse(sql);
    return parsed.length > 0 ? (parsed[0] ?? null) : null;
  } catch {
    return null;
  }
}
