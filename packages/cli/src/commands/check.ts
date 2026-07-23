import {
  analyze,
  ConfigError,
  resolveConfig,
  type BallastConfig,
  type MigrationTool,
  type Report,
  type Severity,
} from "@ballast/core";
import { loadConfig } from "../config-file.js";
import { discoverFiles, readFiles } from "../files.js";
import { formatGithub } from "../formatters/github.js";
import { formatJson } from "../formatters/json.js";
import { formatPretty } from "../formatters/pretty.js";
import { uploadReport } from "../upload.js";

export type OutputFormat = "pretty" | "json" | "github";

export interface CheckOptions {
  cwd: string;
  configPath?: string;
  format?: OutputFormat;
  failOn?: Severity;
  preset?: MigrationTool;
  color?: boolean;
  /** SQL provided via stdin instead of files. */
  stdin?: string;
  stdinFilename?: string;
  upload?: boolean;
}

export interface CheckResult {
  report: Report | null;
  output: string;
  /** Extra lines for stderr (upload status, detection notes). */
  notes: string[];
  exitCode: 0 | 1 | 2;
}

export async function runCheck(
  paths: string[],
  options: CheckOptions,
): Promise<CheckResult> {
  const notes: string[] = [];
  let config: BallastConfig;
  try {
    const loaded = loadConfig(options.cwd, options.configPath);
    config = { ...loaded.config };
    if (loaded.path) notes.push(`config: ${loaded.path}`);
  } catch (err) {
    return {
      report: null,
      output: err instanceof Error ? err.message : String(err),
      notes,
      exitCode: 2,
    };
  }
  if (options.preset) config.preset = options.preset;
  if (options.failOn) config.failOn = options.failOn;

  let inputs: Array<{ filename: string; source: string }>;
  if (options.stdin !== undefined) {
    inputs = [
      {
        filename: options.stdinFilename ?? "stdin.sql",
        source: options.stdin,
      },
    ];
  } else {
    try {
      const resolved = resolveConfig(config);
      const discovered = discoverFiles(paths, options.cwd, resolved.ignore);
      if (discovered.detectedPreset && !config.preset) {
        config.preset = discovered.detectedPreset;
        notes.push(`detected ${discovered.detectedPreset} migrations`);
      }
      if (discovered.files.length === 0) {
        return {
          report: null,
          output:
            paths.length > 0
              ? "No .sql files found in the given paths."
              : "No migrations found. Pass a path: ballast check prisma/migrations",
          notes,
          exitCode: 2,
        };
      }
      inputs = readFiles(discovered.files, options.cwd);
    } catch (err) {
      return {
        report: null,
        output: err instanceof Error ? err.message : String(err),
        notes,
        exitCode: 2,
      };
    }
  }

  let report: Report;
  try {
    report = analyze(inputs, config);
  } catch (err) {
    if (err instanceof ConfigError) {
      return { report: null, output: err.message, notes, exitCode: 2 };
    }
    throw err;
  }

  const format = options.format ?? "pretty";
  const output =
    format === "json"
      ? formatJson(report)
      : format === "github"
        ? formatGithub(report)
        : formatPretty(report, options.color ?? true);

  if (options.upload) {
    const result = await uploadReport(report);
    notes.push(result.message);
  }

  return {
    report,
    output,
    notes,
    exitCode: report.summary.passed ? 0 : 1,
  };
}
