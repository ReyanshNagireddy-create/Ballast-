import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Ballast collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-faint">Last updated: July 22, 2026</p>
        <div className="prose-invert mt-10 space-y-6 text-[15px] leading-relaxed text-muted">
          <section>
            <h2 className="text-lg font-semibold text-ink">The short version</h2>
            <p className="mt-2">
              The open-source CLI makes no network calls and collects nothing.
              Ballast Cloud stores what you send it — check reports and account
              data — to provide the service, and we don&rsquo;t sell any of it.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">What we collect</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-ink">Account data.</strong> Name, email,
                and organization details via our authentication provider
                (Clerk) when you create a cloud account.
              </li>
              <li>
                <strong className="text-ink">Check reports.</strong> When you
                use <code className="font-mono">--upload</code> or the API:
                findings, migration statement excerpts, scores, and CI metadata
                (branch, commit, run URL). Statements are truncated to 200
                characters; we never receive your data, only DDL text.
              </li>
              <li>
                <strong className="text-ink">Rehearsal SQL and timings</strong>{" "}
                when you queue rehearsals against your own rehearsal database.
              </li>
              <li>
                <strong className="text-ink">Billing data.</strong> Handled by
                Stripe; we store subscription status and plan, never card
                numbers.
              </li>
              <li>
                <strong className="text-ink">Operational logs.</strong> IP
                addresses and request metadata for rate limiting and abuse
                prevention, retained for 30 days.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">What we don&rsquo;t do</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>We do not sell or rent personal data. Ever.</li>
              <li>We do not train machine-learning models on your SQL.</li>
              <li>
                The playground&rsquo;s analyze endpoint is stateless: submitted
                SQL is analyzed in memory and not persisted.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Subprocessors</h2>
            <p className="mt-2">
              Clerk (authentication), Stripe (payments), and our hosting
              provider (application and database infrastructure). Each is bound
              by its own data-processing agreement.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Retention & deletion</h2>
            <p className="mt-2">
              Free-plan check history is retained for 90 days; paid plans
              retain until you delete. Deleting a project deletes its checks,
              findings, and API keys immediately. Deleting your organization
              deletes everything within 30 days. Email{" "}
              <a href="mailto:privacy@ballast.dev" className="text-beacon">
                privacy@ballast.dev
              </a>{" "}
              to exercise access, correction, or deletion rights (GDPR/CCPA).
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Changes</h2>
            <p className="mt-2">
              Material changes will be announced in the changelog and by email
              to account owners at least 14 days before taking effect.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
