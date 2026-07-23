# Benchmarks

Honest numbers, honestly framed: Ballast's engine is a static analyzer whose
cost is parsing. The workload that matters — *the migrations in one PR* —
completes in single-digit milliseconds. Whole-history scans are batch jobs
that finish in seconds.

## Method

`npm run bench -w @ballast/core` — synthetic migration files of 7 statements
each (CREATE TABLE, two index builds, ALTER ADD COLUMN, FK, type change,
UPDATE), full analysis with the prisma preset, 5 samples, best-of reported.
Node 22, single thread, containerized x86-64 (a laptop is faster).

## Results (v0.4.0)

| Workload | Statements | Wall time | Throughput |
| --- | --- | --- | --- |
| Typical PR (10 files) | 70 | **22 ms** | ~3,100 stmts/sec |
| Large PR / repo sweep (100 files) | 700 | 224 ms | ~3,100 stmts/sec |
| Full history (1,000 files) | 7,000 | 2.1 s | ~3,300 stmts/sec |

Reproduce: `npm run bench -w @ballast/core` (numbers vary ±15% by hardware;
regenerate this table when the engine changes).

## What we deliberately do not claim

- **We are not the fastest linter.** squawk (Rust) parses faster than our
  TypeScript engine. At PR scale both are far below human-perceptible
  latency, and CI spends 100× longer on `npm install` than on either tool.
  We optimize for rule quality, runner semantics, and fix output — the
  engine is fast *enough*, and we'd rather say so than benchmark-market.
- **Rehearsal timings are not benchmarks of Ballast.** They measure *your
  migration on your data* — that's the point.

## Engine characteristics

- Zero I/O: cost is pure CPU (parse + rule evaluation).
- Memory: O(largest file), statements are analyzed independently.
- Failure isolation: a statement the parser can't model falls back to
  normalized-text rules — worst case is a milder check, never a crash.
