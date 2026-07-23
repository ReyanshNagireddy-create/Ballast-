import type { Report, Severity } from "@ballast/core";

const COMMAND: Record<Severity, "error" | "warning" | "notice"> = {
  blocker: "error",
  warning: "warning",
  notice: "notice",
};

function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function escapeProp(s: string): string {
  return escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/**
 * GitHub Actions workflow-command output: findings become inline annotations
 * on the PR diff, plus a plain-text summary line.
 */
export function formatGithub(report: Report): string {
  const out: string[] = [];
  for (const f of report.findings) {
    const fixHint = f.fix ? ` Fix: ${f.fix.summary}.` : "";
    out.push(
      `::${COMMAND[f.severity]} file=${escapeProp(f.file)},line=${f.line},title=${escapeProp(`ballast: ${f.ruleId}`)}::${escapeData(`${f.message}${fixHint}`)}`,
    );
  }
  const s = report.summary;
  out.push(
    `Ballast: ${s.blockers} blockers, ${s.warnings} warnings, ${s.notices} notices — score ${s.score}/100 (${s.grade}), ${s.passed ? "PASS" : "FAIL"}`,
  );
  return out.join("\n");
}
