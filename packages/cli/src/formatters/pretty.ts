import type { Finding, Report, Severity } from "@ballast/core";
import pc from "picocolors";

const BADGE: Record<Severity, string> = {
  blocker: pc.bgRed(pc.white(" BLOCKER ")),
  warning: pc.bgYellow(pc.black(" WARNING ")),
  notice: pc.bgBlue(pc.white(" NOTICE ")),
};

const PLAIN_BADGE: Record<Severity, string> = {
  blocker: "[BLOCKER]",
  warning: "[WARNING]",
  notice: "[NOTICE] ",
};

function badge(severity: Severity, color: boolean): string {
  return color ? BADGE[severity] : PLAIN_BADGE[severity];
}

function formatFinding(f: Finding, color: boolean): string {
  const location = `${f.file}:${f.line}`;
  const head = `${badge(f.severity, color)} ${color ? pc.bold(f.ruleId) : f.ruleId}  ${color ? pc.dim(location) : location}`;
  const lines = [head, `  ${f.message}`];
  lines.push(`  ${color ? pc.dim(f.statement) : f.statement}`);
  if (f.fix) {
    lines.push(`  ${color ? pc.green("fix:") : "fix:"} ${f.fix.summary}`);
    if (f.fix.sql) {
      lines.push(`    ${color ? pc.cyan(f.fix.sql.replace(/\s+/g, " ").trim()) : f.fix.sql.replace(/\s+/g, " ").trim()}`);
    }
    for (const step of f.fix.steps ?? []) {
      lines.push(`    ${color ? pc.dim("• " + step) : "• " + step}`);
    }
  }
  return lines.join("\n");
}

function scoreBar(score: number, color: boolean): string {
  const filled = Math.round(score / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  if (!color) return bar;
  if (score >= 90) return pc.green(bar);
  if (score >= 60) return pc.yellow(bar);
  return pc.red(bar);
}

export function formatPretty(report: Report, color: boolean): string {
  const { summary, findings } = report;
  const out: string[] = [];
  const title = "Ballast — Postgres migration safety check";
  out.push(color ? pc.bold(title) : title);
  out.push(
    `${summary.files} file${summary.files === 1 ? "" : "s"}, ${summary.statements} statement${summary.statements === 1 ? "" : "s"} analyzed`,
  );
  out.push("");

  if (findings.length === 0) {
    out.push(
      (color ? pc.green("✓ ") : "✓ ") +
        "No migration hazards found. Safe to ship.",
    );
  } else {
    let currentFile = "";
    for (const f of findings) {
      if (f.file !== currentFile) {
        currentFile = f.file;
        out.push(color ? pc.underline(currentFile) : currentFile);
      }
      out.push(formatFinding(f, color));
      out.push("");
    }
  }

  out.push("");
  const counts = [
    summary.blockers > 0 &&
      `${summary.blockers} blocker${summary.blockers === 1 ? "" : "s"}`,
    summary.warnings > 0 &&
      `${summary.warnings} warning${summary.warnings === 1 ? "" : "s"}`,
    summary.notices > 0 &&
      `${summary.notices} notice${summary.notices === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(", ");
  out.push(
    `Safety score  ${scoreBar(summary.score, color)}  ${summary.score}/100 (${summary.grade})` +
      (counts ? `  —  ${counts}` : ""),
  );
  out.push(
    summary.passed
      ? (color ? pc.green("PASS") : "PASS") + " — no findings at or above the fail threshold"
      : (color ? pc.red("FAIL") : "FAIL") + " — findings at or above the fail threshold",
  );
  return out.join("\n");
}
