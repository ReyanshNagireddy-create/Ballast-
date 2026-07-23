/**
 * Static rendering of real `ballast check` output (this is genuine CLI output,
 * not mock copy — regenerate with scripts in examples/ if rules change).
 */
export function TerminalDemo() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface glow-beacon">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-danger/70" />
        <span className="h-3 w-3 rounded-full bg-warn/70" />
        <span className="h-3 w-3 rounded-full bg-ok/70" />
        <span className="ml-3 font-mono text-xs text-faint">
          ballast check prisma/migrations
        </span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-muted">
        <code>
          <span className="text-ink">Ballast — Postgres migration safety check</span>
          {"\n"}1 file, 2 statements analyzed{"\n\n"}
          <span className="text-faint">prisma/migrations/20260722_plan/migration.sql</span>
          {"\n"}
          <span className="rounded bg-danger/20 px-1.5 py-0.5 text-danger">BLOCKER</span>{" "}
          <span className="font-semibold text-ink">require-concurrent-index-creation</span>{" "}
          <span className="text-faint">migration.sql:2</span>
          {"\n"}  Index build on users will block all writes for its full duration.
          {"\n"}  <span className="text-faint">CREATE INDEX users_plan_idx ON users (plan)</span>
          {"\n"}  <span className="text-ok">fix:</span> Create the index concurrently
          {"\n"}    <span className="text-beacon">CREATE INDEX CONCURRENTLY users_plan_idx ON users (plan)</span>
          {"\n\n"}
          <span className="rounded bg-danger/20 px-1.5 py-0.5 text-danger">BLOCKER</span>{" "}
          <span className="font-semibold text-ink">no-not-null-column-without-default</span>{" "}
          <span className="text-faint">migration.sql:1</span>
          {"\n"}  Column &quot;plan&quot; on users is NOT NULL with no DEFAULT — this fails
          {"\n"}  if the table has any rows.
          {"\n"}  <span className="text-ok">fix:</span> Add the column with a DEFAULT, or in phases
          {"\n\n"}
          Safety score  <span className="text-danger">█████░░░░░</span>  47/100 (D)  —  2 blockers, 1 notice
          {"\n"}
          <span className="font-semibold text-danger">FAIL</span> — findings at or above the fail threshold
        </code>
      </pre>
    </div>
  );
}
