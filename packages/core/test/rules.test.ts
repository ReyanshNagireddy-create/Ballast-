import { describe, expect, it } from "vitest";
import { analyzeSql } from "../src/analyze.js";
import type { BallastConfig } from "../src/types.js";

function ruleIds(sql: string, config?: BallastConfig): string[] {
  return analyzeSql(sql, { config }).findings.map((f) => f.ruleId);
}

describe("index rules", () => {
  it("flags non-concurrent index creation on existing tables", () => {
    expect(ruleIds("CREATE INDEX idx ON users (email);")).toContain(
      "require-concurrent-index-creation",
    );
  });

  it("allows concurrent index creation", () => {
    expect(
      ruleIds("CREATE INDEX CONCURRENTLY idx ON users (email);"),
    ).not.toContain("require-concurrent-index-creation");
  });

  it("does not flag indexes on tables created in the same file", () => {
    const sql =
      "CREATE TABLE audit_log (id bigint, actor text);\nCREATE INDEX audit_actor_idx ON audit_log (actor);";
    expect(ruleIds(sql)).not.toContain("require-concurrent-index-creation");
  });

  it("flags non-concurrent drop index", () => {
    expect(ruleIds("DROP INDEX users_email_idx;")).toContain(
      "require-concurrent-index-drop",
    );
  });

  it("flags CONCURRENTLY inside a wrapped transaction", () => {
    expect(
      ruleIds("CREATE INDEX CONCURRENTLY idx ON users (email);", {
        preset: "django",
      }),
    ).toContain("no-concurrent-index-in-transaction");
  });

  it("flags CONCURRENTLY after an explicit BEGIN even without a wrapping runner", () => {
    const sql =
      "BEGIN;\nCREATE INDEX CONCURRENTLY idx ON users (email);\nCOMMIT;";
    expect(ruleIds(sql)).toContain("no-concurrent-index-in-transaction");
  });
});

describe("column rules", () => {
  it("flags NOT NULL column addition without default", () => {
    expect(
      ruleIds("ALTER TABLE users ADD COLUMN tier text NOT NULL;"),
    ).toContain("no-not-null-column-without-default");
  });

  it("accepts NOT NULL with a default", () => {
    expect(
      ruleIds(
        "ALTER TABLE users ADD COLUMN tier text NOT NULL DEFAULT 'free';",
      ),
    ).not.toContain("no-not-null-column-without-default");
  });

  it("flags volatile defaults", () => {
    expect(
      ruleIds(
        "ALTER TABLE users ADD COLUMN ref uuid DEFAULT gen_random_uuid();",
      ),
    ).toContain("no-volatile-default");
  });

  it("accepts constant and stable defaults", () => {
    expect(
      ruleIds(
        "ALTER TABLE users ADD COLUMN created_at timestamptz DEFAULT now();",
      ),
    ).not.toContain("no-volatile-default");
  });

  it("flags column type changes", () => {
    expect(
      ruleIds("ALTER TABLE payments ALTER COLUMN amount TYPE numeric(14,2);"),
    ).toContain("no-column-type-change");
  });

  it("flags SET NOT NULL on existing columns", () => {
    expect(
      ruleIds("ALTER TABLE users ALTER COLUMN email SET NOT NULL;"),
    ).toContain("no-set-not-null-on-existing-column");
  });
});

describe("constraint rules", () => {
  it("flags foreign keys without NOT VALID", () => {
    expect(
      ruleIds(
        "ALTER TABLE orders ADD CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users (id);",
      ),
    ).toContain("require-not-valid-foreign-key");
  });

  it("accepts foreign keys with NOT VALID", () => {
    expect(
      ruleIds(
        "ALTER TABLE orders ADD CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users (id) NOT VALID;",
      ),
    ).not.toContain("require-not-valid-foreign-key");
  });

  it("flags CHECK constraints without NOT VALID", () => {
    expect(
      ruleIds(
        "ALTER TABLE orders ADD CONSTRAINT positive_total CHECK (total > 0);",
      ),
    ).toContain("require-not-valid-check");
  });

  it("flags blocking unique constraints", () => {
    expect(
      ruleIds(
        "ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);",
      ),
    ).toContain("no-blocking-unique-constraint");
  });

  it("accepts unique constraints attached via USING INDEX", () => {
    expect(
      ruleIds(
        "ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE USING INDEX users_email_idx;",
      ),
    ).not.toContain("no-blocking-unique-constraint");
  });
});

describe("compatibility & destructive rules", () => {
  it("flags column renames", () => {
    expect(
      ruleIds("ALTER TABLE users RENAME COLUMN email TO email_address;"),
    ).toContain("no-rename-column");
  });

  it("flags table renames", () => {
    expect(ruleIds("ALTER TABLE users RENAME TO accounts;")).toContain(
      "no-rename-table",
    );
  });

  it("flags column drops", () => {
    expect(ruleIds("ALTER TABLE users DROP COLUMN legacy_flags;")).toContain(
      "no-drop-column",
    );
  });

  it("flags table drops", () => {
    expect(ruleIds("DROP TABLE sessions;")).toContain("no-drop-table");
  });

  it("does not flag dropping a table created in the same file", () => {
    const sql = "CREATE TABLE tmp_backfill (id int);\nDROP TABLE tmp_backfill;";
    expect(ruleIds(sql)).not.toContain("no-drop-table");
  });

  it("flags TRUNCATE and unbounded DML", () => {
    expect(ruleIds("TRUNCATE sessions;")).toContain(
      "no-destructive-data-statement",
    );
    expect(ruleIds("DELETE FROM events;")).toContain(
      "no-destructive-data-statement",
    );
    expect(ruleIds("UPDATE users SET active = true;")).toContain(
      "no-destructive-data-statement",
    );
    expect(
      ruleIds("DELETE FROM events WHERE created_at < now() - interval '90 days';"),
    ).not.toContain("no-destructive-data-statement");
  });
});

describe("maintenance rules", () => {
  it.each([
    "VACUUM FULL users;",
    "CLUSTER users USING users_pkey;",
    "REINDEX TABLE users;",
    "REFRESH MATERIALIZED VIEW daily_stats;",
    "LOCK TABLE users IN ACCESS EXCLUSIVE MODE;",
  ])("flags %s", (sql) => {
    expect(ruleIds(sql)).toContain("no-blocking-maintenance");
  });

  it("accepts concurrent refresh", () => {
    expect(
      ruleIds("REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;"),
    ).not.toContain("no-blocking-maintenance");
  });
});

describe("lock timeout file rule", () => {
  it("notices DDL files without a lock_timeout", () => {
    expect(ruleIds("ALTER TABLE users DROP COLUMN a;")).toContain(
      "require-lock-timeout",
    );
  });

  it("is satisfied by SET lock_timeout", () => {
    expect(
      ruleIds("SET lock_timeout = '5s';\nALTER TABLE users DROP COLUMN a;"),
    ).not.toContain("require-lock-timeout");
  });

  it("stays quiet for pure CREATE TABLE migrations", () => {
    expect(ruleIds("CREATE TABLE fresh (id int);")).not.toContain(
      "require-lock-timeout",
    );
  });
});

describe("enum rule", () => {
  it("flags ADD VALUE in transaction on old Postgres", () => {
    expect(
      ruleIds("ALTER TYPE status ADD VALUE 'archived';", {
        preset: "django",
        pgVersion: 11,
      }),
    ).toContain("no-enum-add-value-in-transaction");
  });

  it("stays quiet on Postgres 12+", () => {
    expect(
      ruleIds("ALTER TYPE status ADD VALUE 'archived';", {
        preset: "django",
        pgVersion: 14,
      }),
    ).not.toContain("no-enum-add-value-in-transaction");
  });
});
