import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Every Ballast release, in order. New rules, features, and fixes.",
};

interface Release {
  version: string;
  date: string;
  title: string;
  changes: Array<{ tag: "new" | "improved" | "fixed"; text: string }>;
}

const releases: Release[] = [
  {
    version: "0.4.0",
    date: "2026-07-22",
    title: "Public launch: cloud, rehearsals, playground",
    changes: [
      { tag: "new", text: "Ballast Cloud: check history, org policy, API keys, and a dashboard for every project." },
      { tag: "new", text: "Migration rehearsals — apply migrations to a disposable production-shaped database with per-statement timings." },
      { tag: "new", text: "Public playground and stateless POST /api/v1/analyze endpoint." },
      { tag: "new", text: "GraphQL API mirroring the REST data model." },
      { tag: "improved", text: "GitHub check annotations now include the safe rewrite inline." },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-30",
    title: "Transaction semantics & three new rules",
    changes: [
      { tag: "new", text: "Presets for Prisma, Django, Rails, Drizzle, Flyway, goose, and golang-migrate — the engine now models whether your runner wraps migrations in a transaction." },
      { tag: "new", text: "no-concurrent-index-in-transaction: catches CONCURRENTLY that would fail with ERROR 25001 under wrapped runners." },
      { tag: "new", text: "no-volatile-default: gen_random_uuid() defaults force full table rewrites; constants don't (PG 11+)." },
      { tag: "new", text: "no-enum-add-value-in-transaction for Postgres < 12." },
      { tag: "fixed", text: "Dollar-quoted function bodies no longer confuse the statement splitter." },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-09",
    title: "False-positive suppression & GitHub output",
    changes: [
      { tag: "new", text: "Same-file table tracking: DDL against tables created in the migration itself stays silent. Initial migrations no longer produce forty findings." },
      { tag: "new", text: "--format github emits workflow commands for inline PR annotations." },
      { tag: "new", text: "Inline suppressions: -- ballast-ignore with an auditable rule list." },
      { tag: "improved", text: "Safety score and letter grade in every report." },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-05-18",
    title: "First release",
    changes: [
      { tag: "new", text: "The core engine: statement splitter, SQL parser integration, and eleven rules covering locking, rewrites, and destructive operations." },
      { tag: "new", text: "ballast check with pretty and JSON output, config file support, and CI-friendly exit codes." },
    ],
  },
];

const TAG_STYLE = {
  new: "bg-beacon/15 text-beacon",
  improved: "bg-indigo-soft/15 text-indigo-soft",
  fixed: "bg-warn/15 text-warn",
} as const;

export default function ChangelogPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Changelog
        </h1>
        <p className="mt-3 text-muted">
          Every release, in order. Follow along on{" "}
          <a
            href="https://github.com/ballast-dev/ballast/releases"
            className="text-beacon hover:text-beacon-bright"
            target="_blank"
            rel="noreferrer"
          >
            GitHub releases
          </a>
          .
        </p>
        <div className="mt-12 space-y-12">
          {releases.map((release) => (
            <section
              key={release.version}
              className="relative border-l border-line pl-8"
            >
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-beacon" />
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-semibold text-ink">
                  v{release.version}
                </h2>
                <time dateTime={release.date} className="text-sm text-faint">
                  {new Date(release.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </div>
              <p className="mt-1 text-sm font-medium text-muted">
                {release.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {release.changes.map((c) => (
                  <li key={c.text} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium uppercase ${TAG_STYLE[c.tag]}`}
                    >
                      {c.tag}
                    </span>
                    <span className="leading-relaxed text-muted">{c.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
