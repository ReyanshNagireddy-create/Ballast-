import { prisma } from "@ballast/db";
import {
  ManageBillingButton,
  UpgradeButton,
} from "@/components/dashboard/billing-buttons";
import { requireOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

const teamFeatures = [
  "Unlimited projects & full check history",
  "Migration rehearsals on production-shaped data",
  "GitHub PR annotations via the Ballast App",
  "Org-wide policy enforcement",
  "Priority support",
];

export default async function BillingPage() {
  const org = await requireOrg();
  const subscription = await prisma.subscription.findUnique({
    where: { orgId: org.id },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Billing
      </h1>
      <p className="mt-1 text-sm text-muted">{org.name}</p>

      <div className="mt-8 rounded-xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {org.plan === "FREE" ? "Free" : org.plan === "TEAM" ? "Team" : "Enterprise"}
            </p>
          </div>
          {subscription ? (
            <p className="text-sm text-muted">
              {subscription.cancelAtPeriodEnd ? "Cancels" : "Renews"}{" "}
              {subscription.currentPeriodEnd.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>

        {org.plan === "FREE" ? (
          <>
            <ul className="mt-6 space-y-2.5">
              {teamFeatures.map((f) => (
                <li key={f} className="flex gap-2.5 text-sm text-muted">
                  <span className="mt-0.5 text-beacon">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <UpgradeButton />
            </div>
          </>
        ) : (
          <div className="mt-6">
            <ManageBillingButton />
          </div>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-faint">
        The open-source CLI and GitHub Action are free forever regardless of
        plan. Downgrading keeps your data exportable for 30 days. Questions:
        support@ballast.dev.
      </p>
    </div>
  );
}
