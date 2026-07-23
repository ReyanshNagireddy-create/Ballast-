export interface PricingTier {
  id: "free" | "team" | "enterprise";
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  cta: { label: string; href: string };
  highlighted: boolean;
  features: string[];
}

export const TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Open source",
    price: "$0",
    cadence: "forever",
    blurb: "The full engine, CLI, and GitHub Action. No account required.",
    cta: { label: "Read the quickstart", href: "/docs/quickstart" },
    highlighted: false,
    features: [
      "All 18 analysis rules, no gating",
      "CLI + GitHub Action + JSON output",
      "Unlimited repos and migrations",
      "Cloud: 1 project, 14-day history",
      "Community support",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$99",
    cadence: "per org / month",
    blurb: "Flat pricing. Not per seat, not per check — your whole org.",
    cta: { label: "Start with Team", href: "/dashboard/billing" },
    highlighted: true,
    features: [
      "Everything in Open source",
      "Unlimited projects & full history",
      "Migration rehearsals on production-shaped data",
      "GitHub PR annotations without wiring credentials",
      "Org-wide policy: rule severities enforced centrally",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    blurb: "For platform teams standardizing migration safety org-wide.",
    cta: { label: "Talk to us", href: "/contact" },
    highlighted: false,
    features: [
      "Everything in Team",
      "SSO / SAML and SCIM",
      "Self-hosted cloud with support SLA",
      "Custom rules & retention policies",
      "Security review & DPA",
    ],
  },
];
