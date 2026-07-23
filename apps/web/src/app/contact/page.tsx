import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Ballast team — sales, support, security, or anything else.",
};

const channels = [
  {
    title: "Sales & Enterprise",
    body: "SSO, self-hosting with an SLA, custom retention, security review. We reply within one business day.",
    href: "mailto:sales@ballast.dev",
    label: "sales@ballast.dev",
  },
  {
    title: "Support",
    body: "Cloud issues, billing, CLI questions. Paid plans get priority; everyone gets an answer.",
    href: "mailto:support@ballast.dev",
    label: "support@ballast.dev",
  },
  {
    title: "Security",
    body: "Found a vulnerability? Please disclose privately — see SECURITY.md in the repo for scope and our PGP key.",
    href: "mailto:security@ballast.dev",
    label: "security@ballast.dev",
  },
  {
    title: "Open source",
    body: "Bug reports, rule proposals, and contributions live on GitHub — issues are triaged weekly, rule proposals get a maintainer response.",
    href: SITE.github,
    label: "github.com/ballast-dev/ballast",
  },
];

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Contact
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Pick the channel and a human will read it. For &ldquo;is this
          migration safe?&rdquo; — that&rsquo;s what the{" "}
          <a href="/playground" className="text-beacon hover:text-beacon-bright">
            playground
          </a>{" "}
          is for.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {channels.map((c) => (
            <a
              key={c.title}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noreferrer" : undefined}
              className="group rounded-xl border border-line bg-surface p-6 transition-colors hover:border-beacon/40"
            >
              <h2 className="font-medium text-ink group-hover:text-beacon-bright">
                {c.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
              <p className="mt-3 font-mono text-sm text-beacon">{c.label}</p>
            </a>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
