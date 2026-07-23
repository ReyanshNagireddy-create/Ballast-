import type { Statement } from "pgsql-ast-parser";

/** Severity levels, ordered from least to most severe. */
export const SEVERITIES = ["notice", "warning", "blocker"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** A rule severity override: a severity level, or "off" to disable. */
export type SeveritySetting = Severity | "off";

export type RuleCategory =
  | "locking"
  | "rewrite"
  | "destructive"
  | "compatibility"
  | "operational";

export interface RuleMeta {
  id: string;
  title: string;
  category: RuleCategory;
  defaultSeverity: Severity;
  /** One-paragraph explanation of the failure mode, written for the engineer reading the finding. */
  why: string;
  /** Stable docs slug, e.g. "require-concurrent-index-creation". */
  slug: string;
}

/** A single SQL statement extracted from a migration file. */
export interface SqlStatement {
  /** Raw SQL text of the statement (without trailing semicolon). */
  sql: string;
  /** Uppercased, comment-stripped, whitespace-collapsed form used by pattern fallbacks. */
  normalized: string;
  /** Parsed AST, or null when pgsql-ast-parser could not parse this statement. */
  ast: Statement | null;
  /** 1-based line number of the statement's first character in the source file. */
  line: number;
  /** 0-based position of the statement within the file. */
  index: number;
  /** Rule ids suppressed for this statement via `-- ballast-ignore` comments; "all" suppresses everything. */
  ignore: Set<string> | "all";
  /** True when the statement executes inside a transaction: an explicit BEGIN
   * earlier in the file, or a migration runner that wraps files in one. */
  inTransaction: boolean;
}

export interface SqlFile {
  filename: string;
  source: string;
  statements: SqlStatement[];
  /** True when a `-- ballast-ignore-file` directive appears near the top of the file. */
  ignoreFile: boolean;
  /** Rule ids suppressed for the whole file via `-- ballast-ignore-file: rule-a, rule-b`. */
  ignoreFileRules: Set<string>;
}

export interface Fix {
  /** Short imperative summary, e.g. "Create the index concurrently". */
  summary: string;
  /** Replacement SQL, when a mechanical rewrite exists. */
  sql?: string;
  /** Extra guidance: sequencing, backfills, deploy ordering. */
  steps?: string[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  category: RuleCategory;
  message: string;
  why: string;
  fix: Fix | null;
  file: string;
  line: number;
  /** The offending statement, truncated for display. */
  statement: string;
}

export interface ReportSummary {
  files: number;
  statements: number;
  blockers: number;
  warnings: number;
  notices: number;
  /** 0–100. Starts at 100; findings subtract. */
  score: number;
  /** Letter grade derived from score. */
  grade: "A" | "B" | "C" | "D" | "F";
  passed: boolean;
}

export interface Report {
  version: string;
  findings: Finding[];
  summary: ReportSummary;
}

export type MigrationTool =
  | "raw"
  | "prisma"
  | "django"
  | "rails"
  | "drizzle"
  | "flyway"
  | "goose"
  | "golang-migrate";

export interface BallastConfig {
  /** Which tool generated/applies these migrations. Controls transaction assumptions and default globs. */
  preset?: MigrationTool;
  /** Postgres major version the target database runs. Default 13. */
  pgVersion?: number;
  /**
   * Whether the migration runner wraps each file in a transaction.
   * Overrides the preset's default when set.
   */
  wrapsInTransaction?: boolean;
  /** Minimum severity that fails the check. Default "blocker". */
  failOn?: Severity;
  /** Per-rule severity overrides, or "off" to disable a rule. */
  rules?: Record<string, SeveritySetting>;
  /** Glob patterns of files to skip entirely. */
  ignore?: string[];
}

export interface ResolvedConfig {
  preset: MigrationTool;
  pgVersion: number;
  wrapsInTransaction: boolean;
  failOn: Severity;
  rules: Record<string, SeveritySetting>;
  ignore: string[];
}

export interface AnalyzeContext {
  config: ResolvedConfig;
  file: SqlFile;
  /**
   * Lowercased names (bare and schema-qualified) of tables created earlier in
   * the same file. DDL against a table that does not exist yet cannot block
   * traffic, so rules skip it — this removes the false positives that make
   * migration linters unbearable on initial migrations.
   */
  createdTables: Set<string>;
}

/** What a rule reports before severity/file metadata are attached. */
export interface RawFinding {
  message: string;
  fix?: Fix;
  /** Override the anchor line (defaults to the statement's line). */
  line?: number;
}

export interface StatementRule {
  kind: "statement";
  meta: RuleMeta;
  check(stmt: SqlStatement, ctx: AnalyzeContext): RawFinding[] | RawFinding | null;
}

export interface FileRule {
  kind: "file";
  meta: RuleMeta;
  check(file: SqlFile, ctx: AnalyzeContext): RawFinding[] | RawFinding | null;
}

export type Rule = StatementRule | FileRule;

export function severityAtLeast(a: Severity, min: Severity): boolean {
  return SEVERITIES.indexOf(a) >= SEVERITIES.indexOf(min);
}
