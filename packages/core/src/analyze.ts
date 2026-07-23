import { resolveConfig } from "./config.js";
import { tryParseStatement } from "./parse.js";
import { ALL_RULES } from "./rules/index.js";
import { truncateSql } from "./rules/util.js";
import { summarize } from "./score.js";
import { normalizeSql, parseIgnoreDirective, splitStatements } from "./split.js";
import type {
  AnalyzeContext,
  BallastConfig,
  Finding,
  RawFinding,
  Report,
  ResolvedConfig,
  Rule,
  SeveritySetting,
  SqlFile,
  SqlStatement,
} from "./types.js";

export const ENGINE_VERSION = "0.4.0";

export interface AnalyzeFileInput {
  filename: string;
  source: string;
}

const CREATE_TABLE_RE =
  /^CREATE (?:GLOBAL |LOCAL )?(?:UNLOGGED |TEMP |TEMPORARY )?TABLE (?:IF NOT EXISTS )?("?[\w$]+"?(?:\."?[\w$]+"?)?)/;

function buildSqlFile(
  input: AnalyzeFileInput,
  config: ResolvedConfig,
): { file: SqlFile; createdTables: Set<string> } {
  const split = splitStatements(input.source);
  const createdTables = new Set<string>();
  const statements: SqlStatement[] = [];

  let inTransaction = config.wrapsInTransaction;

  split.statements.forEach((raw, index) => {
    const normalized = normalizeSql(raw.sql);

    // Track explicit transaction control so `inTransaction` is accurate even
    // for runners that do not wrap files themselves.
    if (/^(BEGIN|START TRANSACTION)\b/.test(normalized)) inTransaction = true;

    const statement: SqlStatement = {
      sql: raw.sql,
      normalized,
      ast: tryParseStatement(raw.sql),
      line: raw.line,
      index,
      ignore: parseIgnoreDirective(raw.leadingComments) ?? new Set(),
      inTransaction,
    };
    statements.push(statement);

    if (/^(COMMIT|ROLLBACK|END)\b/.test(normalized)) {
      inTransaction = config.wrapsInTransaction;
    }

    const created = CREATE_TABLE_RE.exec(normalized);
    if (created && created[1]) {
      const name = created[1].replace(/"/g, "").toLowerCase();
      createdTables.add(name);
      if (name.includes(".")) {
        createdTables.add(name.slice(name.indexOf(".") + 1));
      }
    }
  });

  return {
    file: {
      filename: input.filename,
      source: input.source,
      statements,
      ignoreFile: split.ignoreFile,
      ignoreFileRules: split.ignoreFileRules,
    },
    createdTables,
  };
}

function effectiveSeverity(
  rule: Rule,
  overrides: Record<string, SeveritySetting>,
): SeveritySetting {
  return overrides[rule.meta.id] ?? rule.meta.defaultSeverity;
}

function isSuppressed(rule: Rule, stmt: SqlStatement, file: SqlFile): boolean {
  if (file.ignoreFileRules.has(rule.meta.id)) return true;
  if (stmt.ignore === "all") return true;
  return stmt.ignore.has(rule.meta.id);
}

function toFindings(
  raw: RawFinding[] | RawFinding | null,
  rule: Rule,
  severity: Exclude<SeveritySetting, "off">,
  file: SqlFile,
  fallbackLine: number,
  statementSql: string,
): Finding[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((f) => ({
    ruleId: rule.meta.id,
    severity,
    category: rule.meta.category,
    message: f.message,
    why: rule.meta.why,
    fix: f.fix ?? null,
    file: file.filename,
    line: f.line ?? fallbackLine,
    statement: truncateSql(statementSql),
  }));
}

/** Analyzes one or more migration files and produces a combined report. */
export function analyze(
  files: AnalyzeFileInput[],
  userConfig: BallastConfig = {},
): Report {
  const config = resolveConfig(userConfig);
  const findings: Finding[] = [];
  let statementCount = 0;

  for (const input of files) {
    const { file, createdTables } = buildSqlFile(input, config);
    statementCount += file.statements.length;
    if (file.ignoreFile) continue;

    const ctx: AnalyzeContext = { config, file, createdTables };

    for (const rule of ALL_RULES) {
      const severity = effectiveSeverity(rule, config.rules);
      if (severity === "off") continue;

      if (rule.kind === "file") {
        if (file.ignoreFileRules.has(rule.meta.id)) continue;
        const first = file.statements[0];
        findings.push(
          ...toFindings(
            rule.check(file, ctx),
            rule,
            severity,
            file,
            1,
            first ? first.sql : "",
          ),
        );
        continue;
      }

      for (const stmt of file.statements) {
        if (isSuppressed(rule, stmt, file)) continue;
        findings.push(
          ...toFindings(
            rule.check(stmt, ctx),
            rule,
            severity,
            file,
            stmt.line,
            stmt.sql,
          ),
        );
      }
    }
  }

  findings.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );

  return {
    version: ENGINE_VERSION,
    findings,
    summary: summarize(
      findings,
      { files: files.length, statements: statementCount },
      config.failOn,
    ),
  };
}

/** Convenience wrapper for analyzing a single SQL string. */
export function analyzeSql(
  source: string,
  options: { filename?: string; config?: BallastConfig } = {},
): Report {
  return analyze(
    [{ filename: options.filename ?? "migration.sql", source }],
    options.config,
  );
}
