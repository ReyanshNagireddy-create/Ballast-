import Link from "next/link";
import { ARCHETYPES } from "@productlab/engine";
import { Card, Footer, Nav, Section } from "@/components/chrome";
import { PersonaStream } from "@/components/persona-stream";
import { VIZ } from "@/components/viz";

const STAGES = [
  {
    step: "01",
    title: "It reads your code",
    body: "Point it at a GitHub repo or drop in a ZIP. It maps every route, every button and link, every form field, which screens sit behind auth, and how heavy each screen is to load. No instrumentation, no test IDs, no changes to your app.",
  },
  {
    step: "02",
    title: "It builds a cohort",
    body: "A thousand people who are not you: different ages, devices, connections, patience, reading speed, and accessibility needs. Each one arrives with a goal inferred from your own product — not a script someone wrote by hand.",
  },
  {
    step: "03",
    title: "They use it, and mostly struggle",
    body: "Each persona navigates on labels alone, the way a real person does. They mis-click, they skim, they wait for slow screens, they give up on long forms. Every stumble is recorded against the line of source that caused it.",
  },
  {
    step: "04",
    title: "You get answers, not a test log",
    body: "Where people leave. Which features they wanted and never found. What it will do to retention. Which fix buys back the most sessions per hour of work — ranked, with the file and line to open.",
  },
];

const QUESTIONS = [
  "Would real people understand this product?",
  "Where are users most likely to leave?",
  "Which features actually matter?",
  "What should we build next?",
  "How ready is this for launch?",
];

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main id="main">
        {/* ── hero ── */}
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-field" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div className="animate-fade-up">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-raised/60 px-3 py-1 font-mono text-xs text-cyan">
                <span className="size-1.5 animate-pulse-soft rounded-full bg-cyan" aria-hidden="true" />
                Open beta · React & Next.js
              </p>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                Upload your app.
                <br />
                <span className="accent-text">Simulate 1,000 users</span>
                <br />
                in minutes.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Not another test runner. A virtual product team: a cohort of AI users with real
                devices, real connections, and real limits, who try to get something done in your
                app — and tell you exactly where they gave up.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-gradient-to-r from-cyan to-violet px-6 py-3 text-sm font-semibold text-void transition-opacity hover:opacity-90"
                >
                  Run the sample project
                </Link>
                <Link
                  href="#how"
                  className="rounded-xl border border-line px-6 py-3 text-sm font-medium text-muted transition-colors hover:border-line-bright hover:text-ink"
                >
                  See how it works
                </Link>
              </div>
              <p className="mt-5 font-mono text-xs text-faint">
                No account needed for the sample · 100 personas on the free plan
              </p>
            </div>

            <div className="animate-fade-in lg:pt-6">
              <PersonaStream />
            </div>
          </div>
        </div>

        {/* ── the questions ── */}
        <section className="border-t border-line px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">
              What a report answers
            </p>
            <ul className="mt-8 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {QUESTIONS.map((question) => (
                <li key={question} className="flex items-start gap-3 text-lg text-ink">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-violet" />
                  {question}
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-2xl text-muted">
              Those are product questions, not QA questions. A list of failed assertions cannot
              answer any of them.
            </p>
          </div>
        </section>

        {/* ── how it works ── */}
        <Section
          id="how"
          eyebrow="How it works"
          title="Four stages, one command"
          lead="The whole pipeline is deterministic. The same project and the same seed produce the same report every time — so when a number moves, it moved because your code changed."
        >
          <ol className="grid gap-5 md:grid-cols-2">
            {STAGES.map((stage) => (
              <li key={stage.step}>
                <Card className="h-full">
                  <p className="font-mono text-xs text-cyan">{stage.step}</p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">{stage.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{stage.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── personas ── */}
        <Section
          id="personas"
          eyebrow="The cohort"
          title="The users you never test with"
          lead="Your app works for you. You know where everything is, your phone is new, and your connection is fast. These are the people who do not have any of that."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ARCHETYPES.map((archetype) => (
              <div key={archetype.id} className="rounded-xl border border-line bg-raised/50 p-4">
                <p className="text-sm font-medium text-ink">{archetype.label}</p>
                <dl className="mt-3 space-y-1 font-mono text-xs text-faint">
                  <div className="flex justify-between gap-3">
                    <dt>age</dt>
                    <dd className="text-muted">
                      {archetype.ageRange[0]}–{archetype.ageRange[1]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>patience</dt>
                    <dd className="text-muted">
                      {archetype.patience[0]}–{archetype.patience[1]} confusing steps
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>bandwidth</dt>
                    <dd className="text-muted">
                      {formatKbps(archetype.bandwidthKbps[0])}–{formatKbps(archetype.bandwidthKbps[1])}
                    </dd>
                  </div>
                  {archetype.accessibilityNeeds.length > 0 ? (
                    <div className="pt-1 text-info">{archetype.accessibilityNeeds.join(", ")}</div>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-sm text-faint">
            Cohorts are drawn from these archetypes by weight, so roughly one in seven simulated
            users has an accessibility need and one in twelve is on a connection under 1.2 Mbps.
          </p>
        </Section>

        {/* ── what you get ── */}
        <Section
          eyebrow="The report"
          title="Evidence, ranked by what it costs you"
          lead="Every finding carries the number of sessions it ended and the file and line that caused it. Nothing is scored on vibes."
        >
          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <h3 className="text-lg font-semibold">Drop-off funnel</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Which screens people reach, and which one they were on when they gave up. Sorted by
                traffic, so the expensive leak is at the top.
              </p>
              <div className="mt-5 space-y-2" aria-hidden="true">
                {[100, 72, 41, 12].map((width, index) => (
                  <div key={width} className="h-2.5 overflow-hidden rounded-[4px]" style={{ background: VIZ.track }}>
                    <div
                      className="h-full rounded-[4px]"
                      style={{ width: `${width}%`, background: VIZ.ramp[Math.min(3, index + 1)] }}
                    />
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold">Feature demand</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                A feature nobody uses and a feature nobody can find look identical in analytics.
                Here they do not: demand is measured separately from reach.
              </p>
              <div className="mt-5 space-y-3 font-mono text-xs" aria-hidden="true">
                <p className="flex justify-between text-muted">
                  <span>Bill splitting</span>
                  <span className="text-poor">0% reached · 92 wanted it</span>
                </p>
                <p className="flex justify-between text-muted">
                  <span>Export CSV</span>
                  <span className="text-faint">18% · low demand</span>
                </p>
              </div>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold">A ranked roadmap</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ordered by sessions recovered per unit of effort — fixes and product bets in one
                list, because that is the choice you actually have to make on Monday.
              </p>
              <ol className="mt-5 space-y-2 text-sm text-muted">
                <li className="flex gap-2">
                  <span className="font-mono text-cyan">1.</span> Add labels to the signup form
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-cyan">2.</span> Surface bill splitting in the nav
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-cyan">3.</span> Let people try before signing up
                </li>
              </ol>
            </Card>
          </div>
        </Section>

        {/* ── honesty ── */}
        <section className="border-t border-line px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">What this is not</h2>
            <div className="mt-5 space-y-4 leading-relaxed text-muted">
              <p>
                Simulated users are a model of your product, and a model is wrong in ways the real
                world is not. This will not discover that your pricing is too high, that your
                market does not want the thing, or that your onboarding email lands in spam.
              </p>
              <p>
                What it does do is exhaust the failure modes that are actually in the code — the
                unlabelled control, the screen that takes nine seconds on a budget phone, the
                feature that nothing links to — and it does it before a real person has to find
                them for you. Treat the numbers as a ranked list of things to check, not as
                research. Then go and talk to five real users, with a much better set of questions.
              </p>
            </div>
          </div>
        </section>

        {/* ── cta ── */}
        <section className="border-t border-line px-6 py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Find out on a Tuesday, not on launch day.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
              Run the bundled sample project and read a real report in about thirty seconds. Then
              point it at your own repo.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-gradient-to-r from-cyan to-violet px-6 py-3 text-sm font-semibold text-void transition-opacity hover:opacity-90"
              >
                Open the dashboard
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-line px-6 py-3 text-sm font-medium text-muted transition-colors hover:border-line-bright hover:text-ink"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function formatKbps(kbps: number): string {
  return kbps >= 1000 ? `${Math.round(kbps / 1000)} Mbps` : `${kbps} kbps`;
}
