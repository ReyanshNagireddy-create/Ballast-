import type {
  BallastConfig,
  MigrationTool,
  ResolvedConfig,
  Severity,
  SeveritySetting,
} from "./types.js";
import { SEVERITIES } from "./types.js";

interface PresetInfo {
  wrapsInTransaction: boolean;
  /** Default location of migration SQL for this tool, used by the CLI's auto-detection. */
  migrationGlobs: string[];
  label: string;
}

/**
 * Transaction behavior per migration tool. This matters: `CREATE INDEX
 * CONCURRENTLY` cannot run inside a transaction block, and a failed
 * non-transactional migration leaves the schema half-applied.
 */
export const PRESETS: Record<MigrationTool, PresetInfo> = {
  raw: {
    wrapsInTransaction: false,
    migrationGlobs: ["migrations/**/*.sql"],
    label: "Plain SQL",
  },
  prisma: {
    // Prisma Migrate executes migration.sql without a wrapping transaction.
    wrapsInTransaction: false,
    migrationGlobs: ["prisma/migrations/**/migration.sql"],
    label: "Prisma Migrate",
  },
  django: {
    // Django wraps migrations in a transaction unless atomic = False.
    wrapsInTransaction: true,
    migrationGlobs: ["**/migrations/*.sql"],
    label: "Django",
  },
  rails: {
    // Rails wraps migrations unless disable_ddl_transaction! is set.
    wrapsInTransaction: true,
    migrationGlobs: ["db/migrate/**/*.sql"],
    label: "Rails / Active Record",
  },
  drizzle: {
    wrapsInTransaction: true,
    migrationGlobs: ["drizzle/**/*.sql", "migrations/**/*.sql"],
    label: "Drizzle Kit",
  },
  flyway: {
    wrapsInTransaction: true,
    migrationGlobs: ["sql/**/V*.sql", "db/migration/**/V*.sql"],
    label: "Flyway",
  },
  goose: {
    wrapsInTransaction: true,
    migrationGlobs: ["migrations/**/*.sql"],
    label: "Goose",
  },
  "golang-migrate": {
    wrapsInTransaction: false,
    migrationGlobs: ["migrations/**/*.up.sql", "migrations/**/*.down.sql"],
    label: "golang-migrate",
  },
};

export const CONFIG_FILENAMES = [
  "ballast.config.json",
  ".ballastrc.json",
  ".ballastrc",
];

export const DEFAULT_CONFIG: ResolvedConfig = {
  preset: "raw",
  pgVersion: 13,
  wrapsInTransaction: PRESETS.raw.wrapsInTransaction,
  failOn: "blocker",
  rules: {},
  ignore: [],
};

export class ConfigError extends Error {}

function assertSeveritySetting(id: string, value: unknown): SeveritySetting {
  if (value === "off" || SEVERITIES.includes(value as Severity)) {
    return value as SeveritySetting;
  }
  throw new ConfigError(
    `Invalid severity "${String(value)}" for rule "${id}". ` +
      `Expected one of: off, notice, warning, blocker.`,
  );
}

/** Validates and fills a user config with defaults. Throws ConfigError on invalid input. */
export function resolveConfig(user: BallastConfig = {}): ResolvedConfig {
  const preset: MigrationTool = user.preset ?? "raw";
  if (!(preset in PRESETS)) {
    throw new ConfigError(
      `Unknown preset "${preset}". Expected one of: ${Object.keys(PRESETS).join(", ")}.`,
    );
  }
  const pgVersion = user.pgVersion ?? DEFAULT_CONFIG.pgVersion;
  if (!Number.isInteger(pgVersion) || pgVersion < 9 || pgVersion > 30) {
    throw new ConfigError(
      `Invalid pgVersion ${String(pgVersion)}. Expected a Postgres major version (e.g. 14).`,
    );
  }
  const failOn = user.failOn ?? DEFAULT_CONFIG.failOn;
  if (!SEVERITIES.includes(failOn)) {
    throw new ConfigError(
      `Invalid failOn "${String(failOn)}". Expected one of: ${SEVERITIES.join(", ")}.`,
    );
  }
  const rules: Record<string, SeveritySetting> = {};
  for (const [id, value] of Object.entries(user.rules ?? {})) {
    rules[id] = assertSeveritySetting(id, value);
  }
  return {
    preset,
    pgVersion,
    wrapsInTransaction:
      user.wrapsInTransaction ?? PRESETS[preset].wrapsInTransaction,
    failOn,
    rules,
    ignore: [...(user.ignore ?? [])],
  };
}

/** Identity helper that gives config files type checking in editors. */
export function defineConfig(config: BallastConfig): BallastConfig {
  return config;
}
