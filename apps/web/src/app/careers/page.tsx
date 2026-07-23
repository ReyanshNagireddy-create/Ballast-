import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Help build the safety layer for the world's databases. Small team, open source, remote-first.",
};

const values = [
  {
    title: "Correctness is the product",
    body: "A safety tool that's wrong is worse than no tool. We'd rather ship one rule with an airtight model of Postgres behavior than five approximate ones.",
  },
  {
    title: "Open source is the strategy",
    body: "The engine is Apache-2.0 and always will be. Trust in infrastructure is earned in the open — our community is our moat, not our license.",
  },
  {
    title: "Teach in every artifact",
    body: "Findings explain lock queues. Docs explain trade-offs. Error messages explain what to do next. If a user didn't learn something, we shipped half the feature.",
  },
  {
    title: "Small team, sharp tools",
    body: "We are deliberately few. Everyone ships to production, talks to users, and owns outcomes — with the boring-technology stack (Postgres, TypeScript) we preach.",
  },
];

const roles = [
  {
    title: "Founding Engineer — Database Internals",
    location: "Remote (UTC−8 to UTC+2)",
    type: "Full-time",
    body: "Own the analysis engine. You know what ACCESS EXCLUSIVE conflicts with from memory, you've read the Postgres source when the docs ran out, and you want thousands of teams to benefit from that scar tissue.",
  },
  {
    title: "Founding Engineer — Product",
    location: "Remote (UTC−8 to UTC+2)",
    type: "Full-time",
    body: "Own the cloud: dashboard, APIs, GitHub integration, rehearsals. TypeScript/Next.js fluency, taste for developer tools, and strong opinions about empty states.",
  },
  {
    title: "Developer Relations — Founding",
    location: "Remote",
    type: "Full-time",
    body: "You've run Postgres in production and can write about it. Turn lock semantics into talks, docs, and answers that make people better at their jobs — the content is the marketing.",
  },
];

export default function CareersPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Help keep the internet&rsquo;s databases boring
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Ballast is a small, remote-first team building open-source safety
          infrastructure for Postgres. We&rsquo;re backed, shipping weekly, and
          hiring people who find lock semantics genuinely interesting.
        </p>

        <h2 className="mt-16 text-xl font-semibold text-ink">How we work</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-medium text-ink">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{v.body}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-16 text-xl font-semibold text-ink">Open roles</h2>
        <div className="mt-6 space-y-4">
          {roles.map((role) => (
            <div key={role.title} className="rounded-xl border border-line bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-ink">{role.title}</h3>
                <div className="flex gap-2 text-xs">
                  <span className="rounded bg-raised px-2 py-1 text-muted">{role.location}</span>
                  <span className="rounded bg-raised px-2 py-1 text-muted">{role.type}</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{role.body}</p>
              <a
                href={`mailto:careers@ballast.dev?subject=${encodeURIComponent(role.title)}`}
                className="mt-4 inline-block rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-beacon/40"
              >
                Apply via email →
              </a>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-muted">
          No perfect-fit role? If you&rsquo;ve shipped something relevant —
          an OSS contribution, a postmortem writeup, a better idea for a rule —
          send it to{" "}
          <a href={`mailto:careers@ballast.dev`} className="text-beacon hover:text-beacon-bright">
            careers@ballast.dev
          </a>
          . We read everything.
        </p>
      </main>
      <Footer />
    </>
  );
}
