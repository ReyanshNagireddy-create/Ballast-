import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing use of Ballast Cloud.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-faint">Last updated: July 22, 2026</p>
        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-muted">
          <section>
            <h2 className="text-lg font-semibold text-ink">1. Scope</h2>
            <p className="mt-2">
              These terms cover Ballast Cloud — the hosted dashboard, APIs, and
              rehearsal service operated by Ballast Technologies, Inc. The
              open-source software is licensed separately under Apache-2.0 and
              is not subject to these terms.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">2. Your account</h2>
            <p className="mt-2">
              You are responsible for activity under your organization,
              including API keys your members create. Keep keys secret; rotate
              them immediately if exposed. You must be authorized to submit the
              SQL your team uploads.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">3. Acceptable use</h2>
            <p className="mt-2">
              Don&rsquo;t attempt to breach other tenants&rsquo; data, resell
              the service without an agreement, exceed rate limits by evasion,
              or use the service to violate law. We may suspend accounts that
              endanger the platform, with notice where practicable.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">4. The obvious disclaimer</h2>
            <p className="mt-2">
              Ballast reduces migration risk; it does not eliminate it. Findings
              and rehearsal timings are informational, based on static analysis
              and your rehearsal data. You remain responsible for reviewing and
              executing your own schema changes. The service is provided
              &ldquo;as is&rdquo; without warranties of any kind.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">5. Billing</h2>
            <p className="mt-2">
              Paid plans bill monthly or annually via Stripe. You can cancel
              anytime; access continues through the paid period. We&rsquo;ll
              give 30 days&rsquo; notice before price changes affect an
              existing subscription.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">6. Liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, our aggregate liability
              is limited to the amounts you paid us in the twelve months before
              the claim. Neither party is liable for indirect or consequential
              damages.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">7. Termination & changes</h2>
            <p className="mt-2">
              You may export your data and leave at any time. We may update
              these terms with 14 days&rsquo; notice via the changelog and
              email; continued use after the effective date constitutes
              acceptance. Questions:{" "}
              <a href="mailto:legal@ballast.dev" className="text-beacon">
                legal@ballast.dev
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
