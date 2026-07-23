import type { Report } from "@ballast/core";

/** Stable machine-readable output, used by `--format json` and `--upload`. */
export function formatJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}
