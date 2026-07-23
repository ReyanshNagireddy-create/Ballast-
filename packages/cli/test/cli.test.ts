import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "../src/commands/check.js";
import { runInit } from "../src/commands/init.js";
import { runRules } from "../src/commands/rules.js";
import { globToRegex, matchesAny } from "../src/files.js";
import { uploadReport } from "../src/upload.js";
import { analyzeSql } from "@ballast/core";
import { formatGithub } from "../src/formatters/github.js";
import { formatPretty } from "../src/formatters/pretty.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ballast-cli-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("glob matching", () => {
  it("matches ** across directories", () => {
    expect(globToRegex("prisma/migrations/**/migration.sql").test(
      "prisma/migrations/20260722_add/migration.sql",
    )).toBe(true);
    expect(matchesAny("db/migrate/001_x.sql", ["db/migrate/**/*.sql"])).toBe(true);
    expect(matchesAny("other/001_x.sql", ["db/migrate/**/*.sql"])).toBe(false);
  });

  it("matches single-star within one segment only", () => {
    const re = globToRegex("migrations/*.sql");
    expect(re.test("migrations/a.sql")).toBe(true);
    expect(re.test("migrations/sub/a.sql")).toBe(false);
  });
});

describe("runCheck", () => {
  it("fails with exit 1 on dangerous migrations", async () => {
    writeFileSync(
      join(dir, "001_bad.sql"),
      "CREATE INDEX idx ON users (email);\n",
    );
    const result = await runCheck([dir], { cwd: dir, color: false });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("require-concurrent-index-creation");
    expect(result.output).toContain("FAIL");
  });

  it("passes with exit 0 on safe migrations", async () => {
    writeFileSync(
      join(dir, "001_good.sql"),
      "CREATE TABLE things (id bigint PRIMARY KEY);\n",
    );
    const result = await runCheck([dir], { cwd: dir, color: false });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("PASS");
  });

  it("returns exit 2 when nothing is found", async () => {
    const result = await runCheck([], { cwd: dir, color: false });
    expect(result.exitCode).toBe(2);
  });

  it("auto-detects prisma migrations and preset", async () => {
    const migDir = join(dir, "prisma", "migrations", "20260722_add_index");
    mkdirSync(migDir, { recursive: true });
    writeFileSync(
      join(migDir, "migration.sql"),
      "CREATE INDEX CONCURRENTLY idx ON users (email);\n",
    );
    const result = await runCheck([], { cwd: dir, color: false });
    // Prisma preset does not wrap in a transaction, so CONCURRENTLY is fine.
    expect(result.exitCode).toBe(0);
    expect(result.notes.join(" ")).toContain("prisma");
  });

  it("respects ballast.config.json from the working directory", async () => {
    writeFileSync(
      join(dir, "ballast.config.json"),
      JSON.stringify({ rules: { "no-drop-table": "off", "require-lock-timeout": "off" } }),
    );
    writeFileSync(join(dir, "001_drop.sql"), "DROP TABLE old;\n");
    const result = await runCheck([dir], { cwd: dir, color: false });
    expect(result.exitCode).toBe(0);
  });

  it("reads SQL from stdin", async () => {
    const result = await runCheck([], {
      cwd: dir,
      color: false,
      stdin: "ALTER TABLE users RENAME COLUMN a TO b;",
      stdinFilename: "django.sql",
      failOn: "warning",
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("django.sql");
  });

  it("emits parseable JSON with --format json", async () => {
    writeFileSync(join(dir, "001.sql"), "DROP TABLE old;\n");
    const result = await runCheck([dir], {
      cwd: dir,
      format: "json",
      color: false,
    });
    const parsed = JSON.parse(result.output);
    expect(parsed.summary.blockers).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.findings)).toBe(true);
  });

  it("returns exit 2 on invalid config", async () => {
    writeFileSync(join(dir, "ballast.config.json"), "{not json");
    writeFileSync(join(dir, "001.sql"), "SELECT 1;\n");
    const result = await runCheck([dir], { cwd: dir, color: false });
    expect(result.exitCode).toBe(2);
  });
});

describe("formatters", () => {
  const report = analyzeSql("DROP TABLE gone;", {
    filename: "migrations/001.sql",
  });

  it("github format produces workflow commands with escaping", () => {
    const out = formatGithub(report);
    expect(out).toContain("::error file=migrations/001.sql,line=1");
    expect(out).toContain("ballast%3A no-drop-table");
  });

  it("pretty format shows fixes and score without color codes", () => {
    const out = formatPretty(report, false);
    expect(out).toContain("[BLOCKER]");
    expect(out).toContain("fix:");
    expect(out).toContain("/100");
    expect(out).not.toContain("\u001b[");
  });
});

describe("runInit", () => {
  it("detects prisma and writes config", () => {
    mkdirSync(join(dir, "prisma", "migrations"), { recursive: true });
    const result = runInit(dir);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("prisma");
  });

  it("refuses to overwrite an existing config", () => {
    writeFileSync(join(dir, "ballast.config.json"), "{}");
    expect(runInit(dir).exitCode).toBe(2);
  });
});

describe("runRules", () => {
  it("lists every rule id", () => {
    const out = runRules(false);
    expect(out).toContain("require-concurrent-index-creation");
    expect(out).toContain("no-drop-table");
    expect(out).toContain("require-lock-timeout");
  });
});

describe("uploadReport", () => {
  const report = analyzeSql("SELECT 1;");

  it("skips gracefully without an API key", async () => {
    vi.stubEnv("BALLAST_API_KEY", "");
    const result = await uploadReport(report);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("BALLAST_API_KEY");
    vi.unstubAllEnvs();
  });

  it("posts the report with auth when a key is set", async () => {
    vi.stubEnv("BALLAST_API_KEY", "blt_test_key");
    vi.stubEnv("BALLAST_API_URL", "https://example.test/api/v1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "chk_1", url: "https://ballast.dev/c/1" }), {
        status: 201,
      }),
    );
    const result = await uploadReport(report, fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/v1/checks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer blt_test_key",
        }),
      }),
    );
    vi.unstubAllEnvs();
  });
});
