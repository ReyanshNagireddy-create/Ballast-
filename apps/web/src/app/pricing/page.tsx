import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { SectionHeading } from "@/components/section";
import { TIERS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Ballast is free and open source. Ballast Cloud is $99/month flat for your whole org — not per seat, not per check.",
};

const pricingFaqs = [
  {
    q: "Why flat pricing?",
    a: "Per-seat pricing punishes you for adding the exact people who should see migration safety — reviewers, on-call engineers, new hires. Safety tooling works when everyone can see it, so one price covers the org.",
  },
  {
    q: "What counts as a project?",
    a: "One repository's migration history. Monorepos with multiple databases can map each database to its own project.",
  },
  {
    q: "Can I self-host the cloud?",
    a: "The dashboard and worker are in the open-source repo and run from a single docker-compose file. Enterprise adds a supported build, SSO, and an SLA on top.",
  },
  {
    q: "What happens if I cancel?",
    a: "Your data stays exportable for 30 days, the CLI and Action keep working forever (they're open source), and your cloud plan falls back to the free tier.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-16">
        <SectionHeading
          eyebrow="Pricing"
          title="Free where it should be. Flat where it counts."
          lead="The safety engine is open source forever. The cloud is one flat price for your whole organization."
        />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-2xl border p-7 ${
                tier.highlighted
                  ? "border-beacon/50 bg-surface glow-beacon"
                  : "border-line bg-surface"
              }`}
            >
              {tier.highlighted ? (
                <p className="mb-3 inline-block rounded-full bg-beacon/15 px-3 py-1 text-xs font-medium text-beacon">
                  Most teams start here
                </p>
              ) : null}
              <h2 className="text-lg font-medium text-ink">{tier.name}</h2>
              <p className="mt-3">
                <span className="text-4xl font-semibold tracking-tight text-ink">
                  {tier.price}
                </span>{" "}
                <span className="text-sm text-muted">{tier.cadence}</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {tier.blurb}
              </p>
              <Link
                href={tier.cta.href}
                className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? "bg-beacon text-abyss hover:bg-beacon-bright"
                    : "border border-line text-ink hover:border-beacon/40"
                }`}
              >
                {tier.cta.label}
              </Link>
              <ul className="mt-7 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-muted">
                    <span className="mt-0.5 text-beacon">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-24 max-w-3xl">
          <SectionHeading title="Pricing questions" />
          <div className="mt-10 space-y-3">
            {pricingFaqs.map((f) => (
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
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
