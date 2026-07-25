import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Nav } from "@/components/chrome";
import {
  AdoptionChart,
  FunnelChart,
  HeroScore,
  OutcomeBar,
  ScoreMeter,
  SeverityTag,
  Stat,
  VIZ,
} from "@/components/viz";
import { getProject, getRun } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return { title: `Report ${runId}` };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;
  const [project, run] = await Promise.all([getProject(projectId), getRun(runId)]);
  if (!project || !run || run.projectId !== projectId) notFound();

  if (run.status !== "complete" || !run.report) {
    return (
      <>
        <Nav />
        <main id="main" className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold">This run did not finish</h1>
          <p className="mt-3 text-muted">{run.error ?? "The simulation is still running."}</p>
          <Link href={`/dashboard/${projectId}`} className="mt-8 inline-block text-cyan hover:underline">
            Back to the project
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const { report } = run;
  const total = report.personaCount;
  const business = report.business;

  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-5xl px-6 py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-faint">
          <Link href="/dashboard" className="hover:text-ink">
            Projects
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/dashboard/${projectId}`} className="hover:text-ink">
            {project.name}
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-muted">{runId}</span>
        </nav>

        {/* ── headline ── */}
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{report.projectName}</h1>
            <p className="mt-2 font-mono text-sm text-faint">
              {total} simulated users · seed {report.provenance.seed} ·{" "}
              {new Date(report.createdAt).toLocaleString("en-GB")}
            </p>
          </div>
          <a
            href={`/api/runs/${runId}?download=1`}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-line-bright hover:text-ink"
          >
            Download report (JSON)
          </a>
        </header>

        {report.warnings.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-fair/35 bg-fair/5 p-5">
            <h2 className="text-sm font-semibold text-fair">Read this first</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
              {report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="mt-10 rounded-2xl border border-line bg-raised/50 p-8">
          <HeroScore
            score={report.scores.launchConfidence}
            label="Launch confidence"
            sub={`${report.outcomes.success} of ${total} simulated users finished what they came to do. ${business.primaryLeak}.`}
          />
          <div className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            <ScoreMeter label="Overall product score" score={report.scores.overall} />
            <ScoreMeter label="User experience" score={report.scores.userExperience} />
            <ScoreMeter label="Accessibility" score={report.scores.accessibility} />
            <ScoreMeter label="Performance" score={report.scores.performance} />
            <ScoreMeter label="Business readiness" score={report.scores.businessReadiness} />
            <ScoreMeter label="Security" score={report.scores.security} />
          </div>
        </section>

        {/* ── outcomes ── */}
        <Block title="How the sessions ended">
          <OutcomeBar outcomes={report.outcomes} total={total} />
        </Block>

        {/* ── issues ── */}
        <Block
          title="Top issues"
          lead="Ranked by the number of sessions each one ended — not by how severe the rule sounds."
        >
          {report.issues.length === 0 ? (
            <p className="text-muted">
              No session-level friction was recorded. That is unusual; check that the project&apos;s
              routes were detected correctly.
            </p>
          ) : (
            <ol className="space-y-4">
              {report.issues.slice(0, 10).map((issue, index) => (
                <li key={issue.id} className="rounded-2xl border border-line bg-raised/50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 font-mono text-sm text-faint">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="text-lg font-medium text-ink">{issue.title}</h3>
                        <p className="mt-1 font-mono text-xs text-faint">
                          {issue.file}:{issue.line}
                        </p>
                      </div>
                    </div>
                    <SeverityTag severity={issue.severity} />
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-muted">{issue.detail}</p>

                  <p className="mt-4 rounded-lg border border-cyan/25 bg-cyan/5 px-3.5 py-2.5 text-sm text-ink">
                    <span className="font-medium text-cyan">Fix · </span>
                    {issue.recommendation}
                  </p>

                  {issue.evidence.length > 0 ? (
                    <ul className="mt-4 space-y-1.5 border-l-2 border-line pl-4">
                      {issue.evidence.map((quote) => (
                        <li key={quote} className="text-sm italic text-faint">
                          “{quote}”
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Block>

        {/* ── funnel ── */}
        <Block
          title="Where people went, and where they stopped"
          lead="Screens nobody reached are omitted; a screen missing from this list is a screen no simulated user found."
        >
          <FunnelChart rows={report.funnel} total={total} />
        </Block>

        {/* ── adoption ── */}
        <Block
          title="Predicted feature demand"
          lead="Demand is how many personas arrived wanting a screen. Adoption is how many got there. A gap between the two is a navigation problem, not an unpopular feature."
        >
          <AdoptionChart rows={report.adoption} />
        </Block>

        {/* ── business ── */}
        <Block title="Business outlook">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Day-30 retention"
              value={`${Math.round(business.day30Retention * 100)}%`}
              sub="Modelled from first-session task success"
            />
            <Stat label="Churn risk" value={`${Math.round(business.churnRisk * 100)}%`} />
            <Stat label="Expected rating" value={`${business.expectedRating.toFixed(1)} / 5`} />
            <Stat
              label="Support tickets"
              value={business.supportTicketsPer1000}
              sub="per 1,000 users, from failed sessions"
            />
            <Stat
              label="Conversion"
              value={`${Math.round(business.conversionRate * 100)}%`}
              sub="High-intent personas who finished"
            />
            <Stat label="Screens analysed" value={report.funnel.length} />
          </div>
          <p className="mt-4 text-xs text-faint">
            These are projections from simulated behaviour, not forecasts. Use them to compare two
            versions of your product, not to plan revenue.
          </p>
        </Block>

        {/* ── roadmap ── */}
        <Block
          title="What to do next"
          lead="Ordered by sessions recovered per unit of effort, so fixes and product bets sit in the same list."
        >
          <ol className="space-y-3">
            {report.recommendations.map((rec) => (
              <li
                key={rec.id}
                className="flex gap-4 rounded-2xl border border-line bg-raised/50 p-5"
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-violet/40 font-mono text-xs text-violet-soft">
                  {rec.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{rec.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{rec.rationale}</p>
                  <p className="mt-2.5 font-mono text-xs text-faint">
                    {rec.effort} effort · est. +{rec.impact} points
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Block>

        {/* ── static signals ── */}
        <Block
          title="Read from the code"
          lead="Findings that come from the source itself rather than from a session — they hold whether or not a simulated user tripped over them."
        >
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {report.signals.slice(0, 20).map((signal) => (
              <li key={signal.id} className="flex flex-wrap items-start gap-4 bg-raised/40 px-5 py-4">
                <SeverityTag severity={signal.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{signal.title}</p>
                  <p className="mt-1 text-sm text-muted">{signal.detail}</p>
                  <p className="mt-1.5 font-mono text-xs text-faint">
                    {signal.file}:{signal.line} — {signal.fix}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {report.signals.length > 20 ? (
            <p className="mt-3 text-sm text-faint">
              {report.signals.length - 20} more in the downloadable report.
            </p>
          ) : null}
        </Block>

        {/* ── feedback ── */}
        <Block
          title="What they said"
          lead="One line per session, in the persona's own register. Failures first."
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {report.feedback.slice(0, 24).map((entry) => (
              <li key={entry.personaId} className="rounded-xl border border-line bg-raised/50 p-4">
                <p className="text-sm italic leading-relaxed text-ink">“{entry.quote}”</p>
                <p className="mt-2.5 flex items-center gap-2 text-xs text-faint">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{
                      background:
                        VIZ.outcome[entry.outcome as keyof typeof VIZ.outcome] ?? VIZ.outcome.blocked,
                    }}
                  />
                  {entry.persona}
                </p>
              </li>
            ))}
          </ul>
        </Block>

        <footer className="mt-14 border-t border-line pt-6 font-mono text-xs text-faint">
          engine {report.provenance.engineVersion} · seed {report.provenance.seed} ·{" "}
          {report.provenance.llmEnriched
            ? `recommendation copy rewritten by ${report.provenance.llmModel}; all numbers computed by the simulation`
            : "deterministic simulation, no model in the loop"}
        </footer>
      </main>
      <Footer />
    </>
  );
}

function Block({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {lead ? <p className="mt-2 max-w-3xl text-sm text-muted">{lead}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
