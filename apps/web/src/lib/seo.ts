export const SITE = {
  name: "Ballast",
  tagline: "Ship schema changes without sinking production",
  description:
    "Ballast is the open-source safety layer for Postgres migrations. It catches locking hazards, table rewrites, and downtime risks in the SQL your ORM generates — in CI, before production finds them for you.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://ballast.dev",
  github: "https://github.com/ballast-dev/ballast",
  twitter: "https://x.com/ballastdev",
  email: "hello@ballast.dev",
} as const;
