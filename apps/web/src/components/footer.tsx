import Link from "next/link";
import { SITE } from "@/lib/seo";
import { Logo } from "./logo";

const columns: Array<{ title: string; links: Array<{ href: string; label: string; external?: boolean }> }> = [
  {
    title: "Product",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/pricing", label: "Pricing" },
      { href: "/playground", label: "Playground" },
      { href: "/changelog", label: "Changelog" },
      { href: "/docs/rules", label: "Rules reference" },
    ],
  },
  {
    title: "Open source",
    links: [
      { href: SITE.github, label: "GitHub", external: true },
      { href: `${SITE.github}/blob/main/CONTRIBUTING.md`, label: "Contributing", external: true },
      { href: `${SITE.github}/blob/main/docs/roadmap.md`, label: "Roadmap", external: true },
      { href: `${SITE.github}/releases`, label: "Releases", external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/careers", label: "Careers" },
      { href: "/contact", label: "Contact" },
      { href: SITE.twitter, label: "X / Twitter", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/terms", label: "Terms of service" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              The open-source safety layer for Postgres migrations.
            </p>
            <p className="mt-4 text-xs text-faint">
              © {new Date().getFullYear()} Ballast Technologies, Inc.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-medium text-ink">{col.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-muted transition-colors hover:text-ink"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-sm text-muted transition-colors hover:text-ink"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
