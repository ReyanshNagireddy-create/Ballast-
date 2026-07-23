import { describe, expect, it } from "vitest";
import { analyze, analyzeSql } from "../src/analyze.js";
import { ConfigError, resolveConfig } from "../src/config.js";
import { ALL_RULES } from "../src/rules/index.js";

describe("suppressions", () => {
  it("honors statement-level ignore for a specific rule", () => {
    const sql =
      "-- ballast-ignore: no-drop-table\nDROP TABLE old_events;";
    const report = analyzeSql(sql);
    expect(report.findings.map((f) => f.ruleId)).not.toContain("no-drop-table");
  });

  it("honors blanket statement-level ignore", () => {
    const sql = "-- ballast-ignore\nDROP TABLE old_events;";
    expect(
      analyzeSql(sql).findings.filter((f) => f.line === 2),
    ).toHaveLength(0);
  });

  it("honors file-level ignore", () => {
    const sql = "-- ballast-ignore-file\nDROP TABLE a;\nDROP TABLE b;";
    expect(analyzeSql(sql).findings).toHaveLength(0);
  });

  it("supports disabling rules via config", () => {
    const report = analyzeSql("DROP TABLE a;", {
      config: { rules: { "no-drop-table": "off", "require-lock-timeout": "off" } },
    });
    expect(report.findings).toHaveLength(0);
  });

  it("supports severity overrides via config", () => {
    const report = analyzeSql("DROP TABLE a;", {
      config: { rules: { "no-drop-table": "notice" } },
    });
    const f = report.findings.find((x) => x.ruleId === "no-drop-table");
    expect(f?.severity).toBe("notice");
  });
});

describe("report shape", () => {
  it("computes summary counts, score and pass state", () => {
    const report = analyzeSql(
      "CREATE INDEX idx ON users (email);\nALTER TABLE users RENAME COLUMN a TO b;",
    );
    expect(report.summary.blockers).toBeGreaterThanOrEqual(1);
    expect(report.summary.warnings).toBeGreaterThanOrEqual(1);
    expect(report.summary.score).toBeLessThan(100);
    expect(report.summary.passed).toBe(false);
    expect(report.summary.grade).toMatch(/[A-F]/);
  });

  it("passes clean migrations with a perfect score", () => {
    const report = analyzeSql(
      "CREATE TABLE widgets (id bigint PRIMARY KEY, name text NOT NULL);",
    );
    expect(report.findings).toHaveLength(0);
    expect(report.summary.score).toBe(100);
    expect(report.summary.passed).toBe(true);
  });

  it("respects failOn threshold", () => {
    const warningOnly = "ALTER TABLE users RENAME COLUMN a TO b;";
    expect(
      analyzeSql(warningOnly, {
        config: { failOn: "blocker", rules: { "require-lock-timeout": "off" } },
      }).summary.passed,
    ).toBe(true);
    expect(
      analyzeSql(warningOnly, {
        config: { failOn: "warning", rules: { "require-lock-timeout": "off" } },
      }).summary.passed,
    ).toBe(false);
  });

  it("anchors findings to file and line", () => {
    const report = analyze([
      { filename: "a.sql", source: "SELECT 1;" },
      {
        filename: "b.sql",
        source: "SELECT 1;\nDROP TABLE gone;",
      },
    ]);
    const f = report.findings.find((x) => x.ruleId === "no-drop-table");
    expect(f?.file).toBe("b.sql");
    expect(f?.line).toBe(2);
  });
});

describe("config validation", () => {
  it("rejects unknown presets", () => {
    expect(() => resolveConfig({ preset: "liquibase" as never })).toThrow(
      ConfigError,
    );
  });

  it("rejects invalid severities", () => {
    expect(() =>
      resolveConfig({ rules: { "no-drop-table": "fatal" as never } }),
    ).toThrow(ConfigError);
  });

  it("applies preset transaction defaults with override", () => {
    expect(resolveConfig({ preset: "django" }).wrapsInTransaction).toBe(true);
    expect(
      resolveConfig({ preset: "django", wrapsInTransaction: false })
        .wrapsInTransaction,
    ).toBe(false);
  });
});

describe("rule registry", () => {
  it("has unique ids and complete metadata", () => {
    const ids = new Set<string>();
    for (const rule of ALL_RULES) {
      expect(ids.has(rule.meta.id)).toBe(false);
      ids.add(rule.meta.id);
      expect(rule.meta.title.length).toBeGreaterThan(10);
      expect(rule.meta.why.length).toBeGreaterThan(40);
      expect(rule.meta.slug).toBe(rule.meta.id);
    }
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(15);
  });
});

describe("realistic migrations", () => {
  it("analyzes a typical Prisma migration end-to-end", () => {
    const sql = `
-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- AlterTable (the dangerous part)
ALTER TABLE "User" ADD COLUMN "planId" TEXT NOT NULL;

-- CreateIndex on existing table
CREATE INDEX "User_planId_idx" ON "User"("planId");
`;
    const report = analyzeSql(sql, { config: { preset: "prisma" } });
    const ids = report.findings.map((f) => f.ruleId);
    // New-table index is fine; existing-table index and NOT NULL addition are not.
    expect(ids).toContain("no-not-null-column-without-default");
    expect(ids).toContain("require-concurrent-index-creation");
    expect(
      report.findings.filter(
        (f) => f.ruleId === "require-concurrent-index-creation",
      ),
    ).toHaveLength(1);
    expect(report.summary.passed).toBe(false);
  });

  it("passes the safe version of the same migration", () => {
    const sql = `
SET lock_timeout = '5s';
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
ALTER TABLE "User" ADD COLUMN "planId" TEXT NOT NULL DEFAULT 'free';
CREATE INDEX CONCURRENTLY "User_planId_idx" ON "User"("planId");
`;
    const report = analyzeSql(sql, { config: { preset: "prisma" } });
    expect(report.findings).toHaveLength(0);
    expect(report.summary.score).toBe(100);
  });
});
