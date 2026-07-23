import { describe, expect, it } from "vitest";
import { normalizeSql, splitStatements } from "../src/split.js";

describe("splitStatements", () => {
  it("splits simple statements with line numbers", () => {
    const { statements } = splitStatements(
      "CREATE TABLE a (id int);\n\nALTER TABLE a ADD COLUMN b int;\n",
    );
    expect(statements).toHaveLength(2);
    expect(statements[0]!.line).toBe(1);
    expect(statements[1]!.line).toBe(3);
  });

  it("ignores semicolons inside single-quoted strings", () => {
    const { statements } = splitStatements(
      "INSERT INTO t (v) VALUES ('a;b');\nSELECT 1;",
    );
    expect(statements).toHaveLength(2);
    expect(statements[0]!.sql).toContain("'a;b'");
  });

  it("handles escaped quotes and dollar-quoted bodies", () => {
    const src = [
      "INSERT INTO t VALUES ('it''s; fine');",
      "CREATE FUNCTION f() RETURNS void AS $$ BEGIN PERFORM 1; END; $$ LANGUAGE plpgsql;",
      "SELECT 2;",
    ].join("\n");
    const { statements } = splitStatements(src);
    expect(statements).toHaveLength(3);
    expect(statements[1]!.sql).toContain("$$ BEGIN PERFORM 1; END; $$");
    expect(statements[2]!.line).toBe(3);
  });

  it("handles tagged dollar quotes", () => {
    const { statements } = splitStatements(
      "CREATE FUNCTION g() RETURNS void AS $fn$ SELECT ';'; $fn$ LANGUAGE sql;\nSELECT 1;",
    );
    expect(statements).toHaveLength(2);
  });

  it("strips comments but keeps them as directives", () => {
    const { statements } = splitStatements(
      "-- ballast-ignore: no-drop-table\nDROP TABLE old_stuff;",
    );
    expect(statements).toHaveLength(1);
    expect(statements[0]!.leadingComments.join(" ")).toContain("ballast-ignore");
  });

  it("detects file-level ignore near the top", () => {
    const res = splitStatements("-- ballast-ignore-file\nDROP TABLE a;");
    expect(res.ignoreFile).toBe(true);
  });

  it("does not treat late ignore-file directives as file-level", () => {
    const lines = ["SELECT 1;", "SELECT 2;", "SELECT 3;", "SELECT 4;", "SELECT 5;", "-- ballast-ignore-file", "DROP TABLE a;"];
    const res = splitStatements(lines.join("\n"));
    expect(res.ignoreFile).toBe(false);
  });

  it("survives statements without trailing semicolon", () => {
    const { statements } = splitStatements("SELECT 1");
    expect(statements).toHaveLength(1);
  });

  it("handles nested block comments", () => {
    const { statements } = splitStatements(
      "/* outer /* inner */ still-comment */ SELECT 1;",
    );
    expect(statements).toHaveLength(1);
    expect(statements[0]!.sql).toBe("SELECT 1");
  });
});

describe("normalizeSql", () => {
  it("uppercases outside strings and collapses whitespace", () => {
    expect(normalizeSql("select  'Ok'\n from t")).toBe("SELECT 'Ok' FROM T");
  });

  it("preserves quoted identifiers", () => {
    expect(normalizeSql('alter table "Users" add column x int')).toBe(
      'ALTER TABLE "Users" ADD COLUMN X INT',
    );
  });

  it("strips comments", () => {
    expect(normalizeSql("SELECT 1 -- trailing\n+ 2")).toBe("SELECT 1 + 2");
  });
});
