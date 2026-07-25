import type { ReactNode } from "react";

/**
 * Report visuals.
 *
 * Colour is assigned by the job it does, not by taste:
 *
 *   • magnitude (funnel volume, predicted adoption) → one blue hue, ordinal
 *     steps, more-is-darker;
 *   • identity (the four session outcomes) → a fixed categorical order;
 *   • state (score bands) → the reserved status palette, never reused as a
 *     series colour.
 *
 * Every palette below was checked with the data-viz validator against this
 * app's surface (#0a0e1a): the categorical order passes CVD separation and the
 * normal-vision floor on adjacent pairs, and the ordinal ramp is monotone in
 * lightness with its light end clear of the surface. Every mark is also
 * directly labelled in text, so nothing is carried by colour alone.
 */

export const VIZ = {
  /** Ordinal steps for magnitude, light → dark. */
  ramp: ["#cde2fb", "#86b6ef", "#3987e5", "#184f95"],
  /** Categorical, in fixed order — success, abandoned, dead-end, timeout. */
  outcome: {
    success: "#199e70",
    abandoned: "#3987e5",
    "dead-end": "#d95926",
    timeout: "#9085e9",
    blocked: "#61708c",
  } as const,
  /** Reserved status palette for score bands. */
  status: { good: "#0ca30c", fair: "#fab219", poor: "#d03b3b" },
  track: "rgba(148, 163, 184, 0.14)",
};

export type ScoreBand = "good" | "fair" | "poor";

export function bandFor(score: number): ScoreBand {
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

const BAND_LABEL: Record<ScoreBand, string> = {
  good: "Good",
  fair: "Needs work",
  poor: "At risk",
};

/**
 * A single ratio against a limit — a meter, not a one-bar bar chart.
 * The band name is always rendered, so the colour is a second channel.
 */
export function ScoreMeter({
  label,
  score,
  hint,
}: {
  label: string;
  score: number;
  hint?: string;
}) {
  const band = bandFor(score);
  const color = VIZ.status[band];
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="font-mono text-lg tabular-nums text-ink">{score}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: VIZ.track }}
        role="img"
        aria-label={`${label}: ${score} out of 100, ${BAND_LABEL[band]}`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, score)}%`, background: color }}
        />
      </div>
      <p className="text-xs text-faint">
        <span style={{ color }}>{BAND_LABEL[band]}</span>
        {hint ? ` · ${hint}` : ""}
      </p>
    </div>
  );
}

/** The one number the report leads with. */
export function HeroScore({ score, label, sub }: { score: number; label: string; sub: string }) {
  const band = bandFor(score);
  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${label}: ${score}%`}>
          <circle cx="66" cy="66" r="56" fill="none" stroke={VIZ.track} strokeWidth="8" />
          <circle
            cx="66"
            cy="66"
            r="56"
            fill="none"
            stroke={VIZ.status[band]}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 351.8} 351.8`}
            transform="rotate(-90 66 66)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-semibold tabular-nums">{score}</span>
          <span className="text-xs text-faint">out of 100</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium uppercase tracking-wide text-faint">{label}</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{sub}</p>
      </div>
    </div>
  );
}

const OUTCOME_LABEL: Record<string, string> = {
  success: "Finished the task",
  abandoned: "Gave up",
  "dead-end": "Hit a dead end",
  timeout: "Ran out of time",
  blocked: "Blocked",
};

/**
 * Part-to-whole across the four ways a session can end.
 * Segments carry a 2px surface gap and every segment is named in the legend.
 */
export function OutcomeBar({ outcomes, total }: { outcomes: Record<string, number>; total: number }) {
  const entries = Object.entries(outcomes).filter(([, count]) => count > 0);
  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {entries.map(([outcome, count]) => (
          <div
            key={outcome}
            title={`${OUTCOME_LABEL[outcome] ?? outcome}: ${count} of ${total}`}
            style={{
              width: `${(count / Math.max(1, total)) * 100}%`,
              background: VIZ.outcome[outcome as keyof typeof VIZ.outcome] ?? VIZ.outcome.blocked,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {entries.map(([outcome, count]) => (
          <li key={outcome} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: VIZ.outcome[outcome as keyof typeof VIZ.outcome] ?? VIZ.outcome.blocked }}
            />
            <span className="text-muted">{OUTCOME_LABEL[outcome] ?? outcome}</span>
            <span className="font-mono tabular-nums text-ink">{count}</span>
            <span className="text-faint">({Math.round((count / Math.max(1, total)) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface FunnelRow {
  path: string;
  title: string;
  entered: number;
  droppedOff: number;
  dropOffRate: number;
}

/**
 * Where people go, and where they stop.
 *
 * Two series per row — reached and left — so the legend is mandatory. Volume
 * uses the ordinal ramp; the lost portion uses the reserved critical status
 * colour, and carries its own number so the colour is never load-bearing.
 */
export function FunnelChart({ rows, total }: { rows: FunnelRow[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.entered));
  return (
    <div className="space-y-5">
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: VIZ.ramp[2] }} />
          <span className="text-muted">Reached this screen and moved on</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: VIZ.status.poor }} />
          <span className="text-muted">Session ended here</span>
        </li>
      </ul>

      <div className="space-y-3">
        {rows.map((row) => {
          const width = (row.entered / max) * 100;
          const lostShare = row.entered === 0 ? 0 : row.droppedOff / row.entered;
          return (
            <div key={row.path} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{row.title}</p>
                <p className="truncate font-mono text-xs text-faint">{row.path}</p>
              </div>

              <div className="h-6 w-full">
                <div className="flex h-full gap-[2px]" style={{ width: `${Math.max(3, width)}%` }}>
                  <div
                    className="h-full rounded-l-[4px] last:rounded-r-[4px]"
                    style={{ width: `${(1 - lostShare) * 100}%`, background: VIZ.ramp[2] }}
                    title={`${row.entered - row.droppedOff} continued past ${row.path}`}
                  />
                  {row.droppedOff > 0 ? (
                    <div
                      className="h-full rounded-r-[4px]"
                      style={{ width: `${lostShare * 100}%`, background: VIZ.status.poor }}
                      title={`${row.droppedOff} sessions ended on ${row.path}`}
                    />
                  ) : null}
                </div>
              </div>

              <div className="text-right">
                <p className="font-mono text-sm tabular-nums text-ink">{row.entered}</p>
                <p className="font-mono text-xs tabular-nums text-faint">
                  {row.droppedOff > 0 ? `−${row.droppedOff} left` : "no drop-off"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-faint">
        Counts are unique sessions out of {total}. A session is counted once per screen, however
        many times it passed through.
      </p>
    </div>
  );
}

export interface AdoptionRow {
  feature: string;
  screenId: string;
  adoption: number;
  attempts: number;
  verdict: "invest" | "keep" | "simplify" | "defer";
}

const VERDICT_COPY: Record<AdoptionRow["verdict"], { label: string; note: string }> = {
  invest: { label: "Invest", note: "wanted, but hard to reach" },
  keep: { label: "Keep", note: "pulling real demand" },
  simplify: { label: "Simplify", note: "reached, rarely used" },
  defer: { label: "Defer", note: "little demand either way" },
};

/** Predicted adoption — magnitude, so one hue, stepped by value. */
export function AdoptionChart({ rows }: { rows: AdoptionRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = Math.round(row.adoption * 100);
        const step = VIZ.ramp[Math.min(3, Math.max(1, Math.ceil(row.adoption * 3)))];
        const verdict = VERDICT_COPY[row.verdict];
        return (
          <div key={row.screenId} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-4">
            <p className="truncate text-sm text-ink" title={row.screenId}>
              {row.feature}
            </p>
            <div className="h-6 w-full overflow-hidden rounded-[4px]" style={{ background: VIZ.track }}>
              <div
                className="h-full rounded-[4px]"
                style={{ width: `${Math.max(1.5, pct)}%`, background: step }}
                title={`${pct}% predicted adoption · ${row.attempts} personas came looking for it`}
              />
            </div>
            <div className="flex items-center gap-3 text-right">
              <span className="w-10 font-mono text-sm tabular-nums text-ink">{pct}%</span>
              <span className="w-44 text-left text-xs text-faint">
                <span className="text-muted">{verdict.label}</span> — {verdict.note}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-raised/50 p-4">
      <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1.5 font-mono text-2xl tabular-nums text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

const SEVERITY_STYLE: Record<string, { color: string; label: string }> = {
  blocker: { color: VIZ.status.poor, label: "Blocker" },
  warning: { color: VIZ.status.fair, label: "Warning" },
  notice: { color: VIZ.ramp[2]!, label: "Notice" },
};

export function SeverityTag({ severity }: { severity: string }) {
  const style = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.notice!;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: `${style.color}55`, color: style.color }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: style.color }} />
      {style.label}
    </span>
  );
}
