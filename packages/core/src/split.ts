/**
 * Splits a SQL source file into individual statements while tracking line
 * numbers and `-- ballast-ignore` directives.
 *
 * Handles: single quotes (with '' escapes), double-quoted identifiers,
 * dollar-quoted strings ($$ … $$ and $tag$ … $tag$), line comments, and
 * block comments (nested, as Postgres allows).
 */

interface RawStatement {
  sql: string;
  line: number;
  /** Comment lines immediately preceding the statement. */
  leadingComments: string[];
}

export interface SplitResult {
  statements: RawStatement[];
  ignoreFile: boolean;
  ignoreFileRules: Set<string>;
}

const IGNORE_FILE_RE = /--\s*ballast-ignore-file(?::\s*([\w\-,\s]+))?/i;
const IGNORE_NEXT_RE = /--\s*ballast-ignore(?!-file)(?::\s*([\w\-,\s]+))?/i;

export function parseIgnoreDirective(
  comments: string[],
): Set<string> | "all" | null {
  for (const comment of comments) {
    const m = IGNORE_NEXT_RE.exec(comment);
    if (m) {
      if (!m[1]) return "all";
      return new Set(
        m[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return null;
}

export function splitStatements(source: string): SplitResult {
  const statements: RawStatement[] = [];
  let ignoreFile = false;
  const ignoreFileRules = new Set<string>();

  const n = source.length;
  let i = 0;
  let line = 1;
  let stmtStart = -1;
  let stmtStartLine = 1;
  let pendingComments: string[] = [];

  const pushStatement = (end: number) => {
    if (stmtStart < 0) return;
    const sql = source.slice(stmtStart, end).trim();
    if (sql.length > 0) {
      statements.push({
        sql,
        line: stmtStartLine,
        leadingComments: pendingComments,
      });
    }
    pendingComments = [];
    stmtStart = -1;
  };

  const handleComment = (text: string, atLine: number) => {
    const fileMatch = IGNORE_FILE_RE.exec(text);
    if (fileMatch && atLine <= 5) {
      if (fileMatch[1]) {
        for (const id of fileMatch[1].split(",")) {
          const trimmed = id.trim();
          if (trimmed) ignoreFileRules.add(trimmed);
        }
      } else {
        ignoreFile = true;
      }
      return;
    }
    // Comments inside a statement body do not reset directive tracking.
    if (stmtStart < 0) pendingComments.push(text);
  };

  while (i < n) {
    const ch = source[i]!;
    const next = i + 1 < n ? source[i + 1] : "";

    if (ch === "\n") {
      line++;
      i++;
      continue;
    }

    // Line comment
    if (ch === "-" && next === "-") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      handleComment(source.slice(i, stop), line);
      i = stop;
      continue;
    }

    // Block comment (nested)
    if (ch === "/" && next === "*") {
      const startLine = line;
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (source[j] === "\n") line++;
        if (source[j] === "/" && source[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (source[j] === "*" && source[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      handleComment(source.slice(i, j), startLine);
      i = j;
      continue;
    }

    // Single-quoted string
    if (ch === "'") {
      if (stmtStart < 0) {
        stmtStart = i;
        stmtStartLine = line;
      }
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\n") line++;
        if (source[j] === "'") {
          if (source[j + 1] === "'") {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      i = j;
      continue;
    }

    // Double-quoted identifier
    if (ch === '"') {
      if (stmtStart < 0) {
        stmtStart = i;
        stmtStartLine = line;
      }
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\n") line++;
        if (source[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      i = j;
      continue;
    }

    // Dollar-quoted string
    if (ch === "$") {
      const tagMatch = /^\$[A-Za-z_]*\$/.exec(source.slice(i, i + 64));
      if (tagMatch) {
        if (stmtStart < 0) {
          stmtStart = i;
          stmtStartLine = line;
        }
        const tag = tagMatch[0];
        const close = source.indexOf(tag, i + tag.length);
        const stop = close === -1 ? n : close + tag.length;
        for (let j = i; j < stop; j++) {
          if (source[j] === "\n") line++;
        }
        i = stop;
        continue;
      }
    }

    if (ch === ";") {
      pushStatement(i);
      i++;
      continue;
    }

    if (stmtStart < 0 && !/\s/.test(ch)) {
      stmtStart = i;
      stmtStartLine = line;
    }
    i++;
  }

  pushStatement(n);

  return { statements, ignoreFile, ignoreFileRules };
}

/**
 * Produces the normalized form rules use for pattern matching:
 * comments stripped, strings preserved, whitespace collapsed, uppercased
 * outside of quoted regions.
 */
export function normalizeSql(sql: string): string {
  let out = "";
  const n = sql.length;
  let i = 0;
  while (i < n) {
    const ch = sql[i]!;
    const next = i + 1 < n ? sql[i + 1] : "";

    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? n : end;
      continue;
    }
    if (ch === "/" && next === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (sql[j] === "/" && sql[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (sql[j] === "*" && sql[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      out += " ";
      i = j;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j++;
          break;
        }
        j++;
      }
      out += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < n && sql[j] !== '"') j++;
      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += ch.toUpperCase();
    i++;
  }
  return out.replace(/\s+/g, " ").trim();
}
