"use client";

import { useCallback, useState } from "react";

interface Finding {
  ruleId: string;
  severity: "blocker" | "warning" | "notice";
  message: string;
  why: string;
  fix: { summary: string; sql?: string; steps?: string[] } | null;
  line: number;
}

interface Report {
  findings: Finding[];
  summary: {
    score: number;
    grade: string;
    blockers: number;
    warnings: number;
    notices: number;
    passed: boolean;
    statements: number;
  };
}

const SAMPLE = `ALTER TABLE users ADD COLUMN plan text NOT NULL;
CREATE INDEX users_plan_idx ON users (plan);
ALTER TABLE orders ADD CONSTRAINT orders_user_fk
  FOREIGN KEY (user_id) REFERENCES users (id);`;

const PRESETS = [
  "prisma",
  "raw",
  "django",
  "rails",
  "drizzle",
  "flyway",
  "goose",
  "golang-migrate",
] as const;

const SEVERITY_STYLE: Record<Finding["severity"], string> = {
  blocker: "bg-danger/15 text-danger",
  warning: "bg-warn/15 text-warn",
  notice: "bg-indigo-soft/15 text-indigo-soft",
};

export function PlaygroundClient() {
  const [sql, setSql] = useState(SAMPLE);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>("prisma");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sql, config: { preset } }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      setReport((await res.json()) as Report);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [sql, preset]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="preset" className="text-sm text-muted">
            Migration tool
          </label>
          <select
            id="preset"
            value={preset}
            onChange={(e) =>
              setPreset(e.target.value as (typeof PRESETS)[number])
            }
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-beacon/50 focus:outline-none"
          >
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          aria-label="Migration SQL"
          className="mt-3 h-80 w-full resize-y rounded-xl border border-line bg-surface p-4 font-mono text-sm text-ink focus:border-beacon/50 focus:outline-none"
        />
        <button
          onClick={run}
          disabled={loading || sql.trim().length === 0}
          className="mt-4 w-full rounded-lg bg-beacon px-5 py-2.5 text-sm font-medium text-abyss transition-colors hover:bg-beacon-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Check this migration"}
        </button>
      </div>

      <div aria-live="polite">
        {error ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-5 text-sm text-danger">
            {error}
          </div>
        ) : null}
        {!report && !error ? (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">
            Paste a migration and run the check — the real engine, server-side.
          </div>
        ) : null}
        {report ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-5 py-4">
              <div>
                <p className="text-sm text-muted">Safety score</p>
                <p className="text-2xl font-semibold text-ink">
                  {report.summary.score}/100{" "}
                  <span className="text-base text-muted">
                    ({report.summary.grade})
                  </span>
                </p>
              </div>
              <span
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  report.summary.passed
                    ? "bg-ok/15 text-ok"
                    : "bg-danger/15 text-danger"
                }`}
              >
                {report.summary.passed ? "PASS" : "FAIL"}
              </span>
            </div>
            {report.findings.length === 0 ? (
              <div className="rounded-xl border border-ok/30 bg-ok/10 p-5 text-sm text-ok">
                No migration hazards found. Safe to ship.
              </div>
            ) : (
              report.findings.map((f, i) => (
                <div
                  key={`${f.ruleId}-${i}`}
                  className="rounded-xl border border-line bg-surface p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase ${SEVERITY_STYLE[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <code className="font-mono text-xs text-beacon-bright">
                      {f.ruleId}
                    </code>
                    <span className="text-xs text-faint">line {f.line}</span>
                  </div>
                  <p className="mt-2.5 text-sm text-ink">{f.message}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {f.why}
                  </p>
                  {f.fix ? (
                    <div className="mt-3 rounded-lg border border-line bg-abyss p-3">
                      <p className="text-xs font-medium text-ok">
                        Fix: {f.fix.summary}
                      </p>
                      {f.fix.sql ? (
                        <code className="mt-1.5 block overflow-x-auto font-mono text-xs text-beacon-bright">
                          {f.fix.sql}
                        </code>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
