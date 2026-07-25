import Link from "next/link";
import type { Metadata } from "next";
import { Footer, Nav } from "@/components/chrome";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Free",
    price: "£0",
    cadence: "forever",
    summary: "Enough to find out whether this tells you anything you did not already know.",
    features: [
      "1 project",
      "100 simulated users per run",
      "Full report in the dashboard",
      "React and Next.js",
      "Desktop Chrome behaviour model",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "£29",
    cadence: "per month",
    summary: "For the weeks before a launch, when the cost of being wrong goes up.",
    features: [
      "Unlimited projects",
      "1,000 simulated users per run",
      "Downloadable JSON reports",
      "Run history and seed-matched re-runs",
      "Mobile and slow-network cohorts",
      "Email support",
    ],
    cta: "Go Pro",
    highlighted: true,
  },
  {
    name: "Team",
    price: "Talk to us",
    cadence: "",
    summary: "When the report needs to go in front of people who did not write the code.",
    features: [
      "Everything in Pro",
      "Shared workspaces",
      "CI integration on every pull request",
      "Score regression gates",
      "Private cloud deployment",
    ],
    cta: "Get in touch",
    highlighted: false,
  },
];

const FAQ = [
  {
    q: "Does this replace testing with real users?",
    a: "No, and treating it that way would be a mistake. It exhausts the failure modes that are visible in your code — unlabelled controls, screens nobody links to, forms that ask for too much — so that the time you spend with real people goes on the questions a simulation cannot answer.",
  },
  {
    q: "How accurate are the business projections?",
    a: "They are projections from simulated behaviour, calibrated so that they move in the right direction when your product improves. Use them to compare two versions of your own app. Do not use them to plan revenue.",
  },
  {
    q: "Do you need to run my app?",
    a: "No. The engine reads your source and builds a model of the product from it. Nothing is executed, no browser is launched, and no credentials are needed.",
  },
  {
    q: "Is the same report reproducible?",
    a: "Yes. Every run records its seed, and the same project and seed always produce an identical report. That is what makes it possible to tell whether a change actually helped.",
  },
  {
    q: "What happens to my code?",
    a: "Source is stored so a run can be repeated without re-uploading, and it is never sent to a model. When LLM enrichment is switched on it only sees the issue summaries — counts and titles — never your code.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main id="main">
        <section className="border-b border-line px-6 py-20 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Cheaper than the launch that goes wrong
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Start free on the sample project. Upgrade when you want a bigger cohort and a report you
            can hand to somebody else.
          </p>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-7 ${
                  plan.highlighted
                    ? "border-violet/50 bg-gradient-to-b from-violet/10 to-transparent"
                    : "border-line bg-raised/40"
                }`}
              >
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-mono text-4xl">{plan.price}</span>
                  {plan.cadence ? <span className="text-sm text-faint">{plan.cadence}</span> : null}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted">{plan.summary}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-muted">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`mt-7 rounded-xl px-5 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90 ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-cyan to-violet text-void"
                      : "border border-line text-ink"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">Questions people actually ask</h2>
            <dl className="mt-8 space-y-7">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt className="font-medium text-ink">{item.q}</dt>
                  <dd className="mt-2 leading-relaxed text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
