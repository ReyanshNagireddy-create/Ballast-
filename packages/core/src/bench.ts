/**
 * Micro-benchmark for the analysis engine. Run with `npm run bench -w @ballast/core`.
 * Numbers land in docs/benchmarks.md — regenerate them when the engine changes.
 */
import { analyze, type AnalyzeFileInput } from "./analyze.js";

function syntheticMigration(i: number): string {
  return [
    `CREATE TABLE orders_${i} (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint NOT NULL, total numeric(12,2), created_at timestamptz NOT NULL DEFAULT now());`,
    `CREATE INDEX orders_${i}_user_idx ON orders_${i} (user_id);`,
    `ALTER TABLE users ADD COLUMN last_order_${i} bigint;`,
    `CREATE INDEX users_last_order_${i}_idx ON users (last_order_${i});`,
    `ALTER TABLE users ADD CONSTRAINT users_order_fk_${i} FOREIGN KEY (last_order_${i}) REFERENCES orders_${i} (id);`,
    `ALTER TABLE payments ALTER COLUMN amount_${i} TYPE numeric(14,2);`,
    `UPDATE settings SET flags = flags WHERE tenant = ${i};`,
  ].join("\n");
}

function run(files: number): { ms: number; statements: number; findings: number } {
  const inputs: AnalyzeFileInput[] = [];
  for (let i = 0; i < files; i++) {
    inputs.push({ filename: `m_${i}.sql`, source: syntheticMigration(i) });
  }
  const start = performance.now();
  const report = analyze(inputs, { preset: "prisma" });
  const ms = performance.now() - start;
  return { ms, statements: report.summary.statements, findings: report.findings.length };
}

// Warmup for JIT stability.
run(50);

for (const files of [10, 100, 1000]) {
  const samples: number[] = [];
  let last = run(files);
  for (let s = 0; s < 5; s++) {
    last = run(files);
    samples.push(last.ms);
  }
  const best = Math.min(...samples);
  const stmtsPerSec = Math.round((last.statements / best) * 1000);
  console.log(
    `${String(files).padStart(5)} files  ${String(last.statements).padStart(6)} statements  ` +
      `best ${best.toFixed(1).padStart(7)} ms  ${stmtsPerSec.toLocaleString("en-US").padStart(10)} stmts/sec  ` +
      `${last.findings} findings`,
  );
}
