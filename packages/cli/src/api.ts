/** Programmatic API for the Ballast CLI (used by tests and integrations). */
export { runCheck } from "./commands/check.js";
export type { CheckOptions, CheckResult, OutputFormat } from "./commands/check.js";
export { runInit } from "./commands/init.js";
export { runRules } from "./commands/rules.js";
export { loadConfig } from "./config-file.js";
export { discoverFiles, globToRegex, matchesAny, readFiles } from "./files.js";
export { formatGithub } from "./formatters/github.js";
export { formatJson } from "./formatters/json.js";
export { formatPretty } from "./formatters/pretty.js";
export { uploadReport } from "./upload.js";
