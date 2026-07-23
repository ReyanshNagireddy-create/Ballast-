import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkUploadSchema } from "@/lib/report-schema";

describe("api keys", () => {
  it("generates blt_live_ keys with stable hash and prefix", () => {
    const key = generateApiKey();
    expect(key.plaintext).toMatch(/^blt_live_[0-9a-f]{48}$/);
    expect(key.prefix).toBe(key.plaintext.slice(0, 13));
    expect(key.hashed).toBe(hashApiKey(key.plaintext));
    expect(key.hashed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique keys", () => {
    const seen = new Set(
      Array.from({ length: 50 }, () => generateApiKey().plaintext),
    );
    expect(seen.size).toBe(50);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5).allowed).toBe(true);
    }
    expect(rateLimit(key, 5).allowed).toBe(false);
  });

  it("tracks keys independently", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    expect(rateLimit(a, 1).allowed).toBe(true);
    expect(rateLimit(a, 1).allowed).toBe(false);
    expect(rateLimit(b, 1).allowed).toBe(true);
  });
});

describe("check upload schema", () => {
  const validReport = {
    version: "0.4.0",
    findings: [
      {
        ruleId: "no-drop-table",
        severity: "blocker",
        category: "destructive",
        message: "DROP TABLE gone permanently destroys data.",
        why: "Dropping a table destroys its data with no transactional undo once the migration commits.",
        fix: { summary: "Soft-decommission before dropping" },
        file: "001.sql",
        line: 1,
        statement: "DROP TABLE gone",
      },
    ],
    summary: {
      files: 1,
      statements: 1,
      blockers: 1,
      warnings: 0,
      notices: 0,
      score: 75,
      grade: "B",
      passed: false,
    },
  };

  it("accepts a valid CLI upload", () => {
    const parsed = checkUploadSchema.safeParse({
      report: validReport,
      meta: { branch: "main", commit: "a".repeat(40) },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed severities and scores", () => {
    expect(
      checkUploadSchema.safeParse({
        report: {
          ...validReport,
          summary: { ...validReport.summary, score: 250 },
        },
      }).success,
    ).toBe(false);
    expect(
      checkUploadSchema.safeParse({
        report: {
          ...validReport,
          findings: [{ ...validReport.findings[0], severity: "catastrophic" }],
        },
      }).success,
    ).toBe(false);
  });
});
