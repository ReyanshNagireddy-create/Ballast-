import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  CONFIG_FILENAMES,
  ConfigError,
  type BallastConfig,
} from "@ballast/core";

export interface LoadedConfig {
  config: BallastConfig;
  /** Absolute path of the config file, or null when using defaults. */
  path: string | null;
}

function parseConfigFile(path: string): BallastConfig {
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw) as BallastConfig;
  } catch (err) {
    throw new ConfigError(
      `Could not parse ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Loads config from an explicit path, or searches upward from cwd for
 * ballast.config.json / .ballastrc(.json). Missing config is not an error —
 * defaults apply.
 */
export function loadConfig(cwd: string, explicitPath?: string): LoadedConfig {
  if (explicitPath) {
    const abs = resolve(cwd, explicitPath);
    if (!existsSync(abs)) {
      throw new ConfigError(`Config file not found: ${explicitPath}`);
    }
    return { config: parseConfigFile(abs), path: abs };
  }

  let dir = resolve(cwd);
  for (;;) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        return { config: parseConfigFile(candidate), path: candidate };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { config: {}, path: null };
}
