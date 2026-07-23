import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { PRESETS, type MigrationTool } from "@ballast/core";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "build"]);

/** Converts a minimal glob (`*`, `**`, `?`) to a RegExp over slash-separated paths. */
export function globToRegex(glob: string): RegExp {
  let re = "";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i]!;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
      } else {
        re += "[^/]*";
        i += 1;
      }
    } else if (ch === "?") {
      re += "[^/]";
      i += 1;
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(path: string, globs: string[]): boolean {
  const normalized = path.split(sep).join("/");
  return globs.some((g) => globToRegex(g).test(normalized));
}

function walkSql(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkSql(join(dir, entry.name), out);
    } else if (entry.name.endsWith(".sql")) {
      out.push(join(dir, entry.name));
    }
  }
}

export interface DiscoveredFiles {
  files: string[];
  detectedPreset: MigrationTool | null;
}

/**
 * Resolves the SQL files to check. Explicit paths win; with no paths, walks
 * the presets' conventional locations (prisma/migrations, db/migrate, …) and
 * reports which tool's layout matched.
 */
export function discoverFiles(
  paths: string[],
  cwd: string,
  ignore: string[],
): DiscoveredFiles {
  const files: string[] = [];
  let detectedPreset: MigrationTool | null = null;

  if (paths.length > 0) {
    for (const p of paths) {
      const abs = resolve(cwd, p);
      let st;
      try {
        st = statSync(abs);
      } catch {
        throw new Error(`Path not found: ${p}`);
      }
      if (st.isDirectory()) walkSql(abs, files);
      else files.push(abs);
    }
  } else {
    const candidates: string[] = [];
    walkSql(cwd, candidates);
    for (const [preset, info] of Object.entries(PRESETS) as Array<
      [MigrationTool, (typeof PRESETS)[MigrationTool]]
    >) {
      if (preset === "raw") continue;
      const matched = candidates.filter((f) =>
        matchesAny(relative(cwd, f), info.migrationGlobs),
      );
      if (matched.length > 0) {
        detectedPreset = preset;
        files.push(...matched);
        break;
      }
    }
  }

  const unique = [...new Set(files)].sort();
  const kept = unique.filter((f) => !matchesAny(relative(cwd, f), ignore));
  return { files: kept, detectedPreset };
}

export function readFiles(
  files: string[],
  cwd: string,
): Array<{ filename: string; source: string }> {
  return files.map((f) => ({
    filename: relative(cwd, f).split(sep).join("/"),
    source: readFileSync(f, "utf8"),
  }));
}
