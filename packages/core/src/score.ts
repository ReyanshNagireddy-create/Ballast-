import type { Finding, ReportSummary, Severity } from "./types.js";
import { severityAtLeast } from "./types.js";

const PENALTY: Record<Severity, number> = {
  blocker: 25,
  warning: 10,
  notice: 3,
};

export function grade(score: number): ReportSummary["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function summarize(
  findings: Finding[],
  counts: { files: number; statements: number },
  failOn: Severity,
): ReportSummary {
  let blockers = 0;
  let warnings = 0;
  let notices = 0;
  let penalty = 0;
  for (const f of findings) {
    penalty += PENALTY[f.severity];
    if (f.severity === "blocker") blockers++;
    else if (f.severity === "warning") warnings++;
    else notices++;
  }
  const score = Math.max(0, 100 - penalty);
  return {
    files: counts.files,
    statements: counts.statements,
    blockers,
    warnings,
    notices,
    score,
    grade: grade(score),
    passed: !findings.some((f) => severityAtLeast(f.severity, failOn)),
  };
}
