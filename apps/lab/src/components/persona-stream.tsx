/**
 * The hero animation.
 *
 * Real personas from the engine's own archetype table, scrolling as a marquee.
 * Nothing here is invented for the marketing page: every row is a cohort the
 * simulation actually generates, which is the point — the demo and the product
 * are the same thing.
 */
const ROWS = [
  { name: "Emily, 19", device: "iPhone", note: "Leaves after three confusing clicks", tone: "warn" },
  { name: "David, 67", device: "Tablet", note: "Reads every screen, needs larger text", tone: "info" },
  { name: "Alex, 31", device: "Desktop", note: "Software engineer — probes the edges", tone: "ok" },
  { name: "Priya, 38", device: "Android", note: "Budget phone, 900 kbps", tone: "warn" },
  { name: "Jamal, 44", device: "Desktop", note: "Screen reader, keyboard only", tone: "info" },
  { name: "Sofia, 27", device: "iPhone", note: "Impatient shopper, 40s of attention", tone: "warn" },
  { name: "Ruth, 58", device: "Desktop", note: "Small business owner, high intent", tone: "ok" },
  { name: "Tom, 22", device: "Android", note: "Scans, never reads the copy", tone: "info" },
];

const TONE: Record<string, string> = {
  ok: "border-good/30 text-good",
  warn: "border-fair/30 text-fair",
  info: "border-info/30 text-info",
};

export function PersonaStream() {
  const doubled = [...ROWS, ...ROWS];
  return (
    <div
      className="relative h-[268px] overflow-hidden rounded-2xl border border-line bg-surface/70"
      aria-label="A sample of the personas the simulator generates"
    >
      <div className="absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-surface to-transparent" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-surface to-transparent" />
      <ul className="animate-drift space-y-2 p-3">
        {doubled.map((row, index) => (
          <li
            key={`${row.name}-${index}`}
            className="flex items-center gap-3 rounded-xl border border-line bg-raised/60 px-3 py-2.5"
          >
            <span
              aria-hidden="true"
              className={`grid size-8 shrink-0 place-items-center rounded-lg border font-mono text-xs ${TONE[row.tone]}`}
            >
              {row.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">
                {row.name} <span className="text-faint">· {row.device}</span>
              </p>
              <p className="truncate text-xs text-muted">{row.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
