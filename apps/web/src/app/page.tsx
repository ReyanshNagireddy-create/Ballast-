import Link from "next/link";
import { ALL_RULES } from "@ballast/core";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { Card, SectionHeading } from "@/components/section";
import { TerminalDemo } from "@/components/terminal-demo";
import { SITE } from "@/lib/seo";

const steps = [
  {
    title: "Analyze",
    body: "Ballast parses every migration in the PR — Prisma, Django, Rails, Drizzle, or raw SQL — and checks it against 18 rules encoding how Postgres locking actually works.",
  },
  {
    title: "Gate",
    body: "Blockers fail CI with inline annotations on the exact line, an explanation of the failure mode, and the safe rewrite. Warnings educate without blocking.",
  },
  {
    title: "Rehearse",
    body: "On Ballast Cloud, migrations are applied to a disposable, production-shaped database first — so you see real timings and rewrite costs before deploy day.",
  },
];

/**
 * Deliberately not fake praise: these paraphrase the complaints engineers
 * make in public postmortems and forum threads about migration incidents.
 * The product exists because these sentences keep getting written.
 */
const painQuotes = [
  {
    quote:
      "The migration ran instantly in staging. In production it wanted an ACCESS EXCLUSIVE lock behind a four-minute analytics query — and every request queued behind it.",
    attribution: "Every lock-queue postmortem, eventually",
  },
  {
    quote:
      "Nobody on the team knew CREATE INDEX blocks writes. Why would they? The ORM generated the migration and the ORM said nothing.",
    attribution: "The retro after the retro",
  },
  {
    quote:
      "We added a NOT NULL column. It worked on every table except the one with 200 million rows — which is of course the one that matters.",
    attribution: "A deploy channel, at 6:03 PM on a Friday",
  },
];

const faqs = [
  {
    q: "Is Ballast another migration tool?",
    a: "No — and that's the point. Ballast doesn't run, generate, or version your migrations. It analyzes the SQL your existing tool (Prisma, Django, Rails, Drizzle, Flyway, goose, or plain files) already produces, and gates CI when a change would take dangerous locks or rewrite tables under load. Nothing about your workflow changes.",
  },
  {
    q: "How is this different from squawk or strong_migrations?",
    a: "Those are good linters and we credit them in our docs. Ballast goes further in three ways: it understands your migration tool's transaction semantics (a rule like 'CONCURRENTLY fails inside a transaction' depends on the runner), it suppresses the false positives that make linters unbearable (DDL against tables created in the same file is safe and stays quiet), and the cloud adds history, team policy, PR annotations, and rehearsals on production-shaped data.",
  },
  {
    q: "Do I need Ballast Cloud?",
    a: "No. The engine, CLI, and GitHub Action are Apache-2.0 and fully usable forever without an account. Cloud adds the team layer: dashboards, check history, org-wide policy, GitHub annotations without wiring credentials, and migration rehearsals.",
  },
  {
    q: "What about MySQL?",
    a: "Postgres first, deliberately — lock semantics are where the danger lives, and doing one engine precisely beats doing two vaguely. MySQL support is on the public roadmap.",
  },
  {
    q: "Will it drown my team in false positives?",
    a: "The engine tracks which tables a migration itself creates and stays quiet about them — the classic 'initial migration triggers forty warnings' failure of naive linters. Every rule can be tuned per-project (severity, off) and suppressed per-statement with an auditable inline comment.",
  },
];

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-grid absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-20 sm:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
                <span className="animate-pulse-soft inline-block h-1.5 w-1.5 rounded-full bg-beacon" />
                Open source · Apache-2.0
              </p>
              <h1 className="animate-fade-up mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-6xl">
                Ship schema changes without{" "}
                <span className="bg-gradient-to-r from-beacon to-indigo-soft bg-clip-text text-transparent">
                  sinking production
                </span>
              </h1>
              <p className="animate-fade-up mt-6 text-lg leading-relaxed text-muted [animation-delay:100ms]">
                Ballast is the open-source safety layer for Postgres migrations.
                It catches the locking hazards, table rewrites, and silent
                downtime risks your ORM generates — in CI, before production
                finds them for you.
              </p>
              <div className="animate-fade-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row [animation-delay:200ms]">
                <code className="rounded-lg border border-line bg-surface px-4 py-2.5 font-mono text-sm text-beacon-bright">
                  npx @ballast/cli check
                </code>
                <a
                  href={SITE.github}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-beacon px-5 py-2.5 text-sm font-medium text-abyss transition-colors hover:bg-beacon-bright"
                >
                  Star on GitHub
                </a>
                <Link
                  href="/playground"
                  className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-beacon/40"
                >
                  Try the playground
                </Link>
              </div>
            </div>
            <div className="animate-fade-up mx-auto mt-16 max-w-3xl [animation-delay:300ms]">
              <TerminalDemo />
            </div>
          </div>
        </section>

        {/* Problem statement */}
        <section className="border-t border-line py-24">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading
              eyebrow="The problem"
              title="Staging can't tell you what production will do"
              lead="Dangerous migrations pass code review because they're syntactically perfect, pass staging because staging is small, and then meet a table with two hundred million rows and live traffic."
            />
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              <Card title="The ORM won't warn you">
                Prisma, Django, Rails, and Drizzle generate correct DDL — with
                zero commentary on lock behavior. <code className="font-mono text-beacon-bright">CREATE INDEX</code>{" "}
                blocking every write on the table is not in the diff.
              </Card>
              <Card title="Locks queue, then cascade">
                Even an &ldquo;instant&rdquo; ALTER waits for an ACCESS
                EXCLUSIVE lock — and every query arriving after it queues behind
                it. One long-running read turns a one-second migration into a
                site-wide stall.
              </Card>
              <Card title="Review can't catch it">
                Knowing which of Postgres&rsquo;s dozens of DDL forms rewrite
                tables, which validate under lock, and which changed in PG 11,
                12, and 15 is a specialist skill. Your reviewer is human.
              </Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-line bg-surface/30 py-24">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading
              eyebrow="How it works"
              title="Analyze. Gate. Rehearse."
              lead="A deterministic engine that understands Postgres lock semantics and your migration tool's transaction behavior — wired into CI in two minutes."
            />
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {steps.map((s, i) => (
                <div
                  key={s.title}
                  className="rounded-xl border border-line bg-surface p-6"
                >
                  <span className="font-mono text-sm text-beacon">
                    0{i + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-medium text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rules — rendered from the actual engine registry */}
        <section className="border-t border-line py-24">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading
              eyebrow={`${ALL_RULES.length} rules and counting`}
              title="Every rule encodes a production incident"
              lead="This grid renders live from the engine's rule registry — what you see is what CI enforces."
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_RULES.map((rule) => (
                <Link
                  key={rule.meta.id}
                  href={`/docs/rules#${rule.meta.slug}`}
                  className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-beacon/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs text-beacon-bright">
                      {rule.meta.id}
                    </code>
                    <span
                      className={
                        rule.meta.defaultSeverity === "blocker"
                          ? "rounded bg-danger/15 px-2 py-0.5 text-[11px] font-medium text-danger"
                          : rule.meta.defaultSeverity === "warning"
                            ? "rounded bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn"
                            : "rounded bg-indigo-soft/15 px-2 py-0.5 text-[11px] font-medium text-indigo-soft"
                      }
                    >
                      {rule.meta.defaultSeverity}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink group-hover:text-beacon-bright">
                    {rule.meta.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Voice of the incident */}
        <section className="border-t border-line bg-surface/30 py-24">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeading
              eyebrow="Sound familiar?"
              title="Sentences that keep getting written"
            />
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {painQuotes.map((t) => (
                <figure
                  key={t.attribution}
                  className="rounded-xl border border-line bg-surface p-6"
                >
                  <blockquote className="text-sm leading-relaxed text-ink">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 text-xs text-faint">
                    — {t.attribution}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Open source */}
        <section className="border-t border-line py-24">
          <div className="mx-auto max-w-4xl px-5 text-center">
            <SectionHeading
              eyebrow="Open source"
              title="The engine is Apache-2.0. Forever."
              lead="Safety tooling you can't audit is a contradiction. The analyzer, CLI, and GitHub Action are open source and fully useful without an account — the cloud exists for teams who want history, policy, and rehearsals."
            />
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={SITE.github}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-beacon px-5 py-2.5 text-sm font-medium text-abyss transition-colors hover:bg-beacon-bright"
              >
                Read the source
              </a>
              <Link
                href="/docs/quickstart"
                className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-beacon/40"
              >
                Quickstart →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-line bg-surface/30 py-24">
          <div className="mx-auto max-w-3xl px-5">
            <SectionHeading eyebrow="FAQ" title="Fair questions" />
            <div className="mt-12 space-y-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-line bg-surface px-6 py-4"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:content-none">
                    <span className="flex items-center justify-between gap-4">
                      {f.q}
                      <span className="text-faint transition-transform group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-line py-24">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Your next migration is one{" "}
              <code className="font-mono text-beacon-bright">npx</code> away
              from being checked
            </h2>
            <p className="mt-4 text-muted">
              No account. No config. Point it at your migrations directory.
            </p>
            <code className="mt-8 inline-block rounded-lg border border-line bg-surface px-5 py-3 font-mono text-sm text-beacon-bright">
              npx @ballast/cli check prisma/migrations
            </code>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
