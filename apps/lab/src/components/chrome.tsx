import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="pl-mark" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" stroke="url(#pl-mark)" strokeWidth="1.6" />
        <circle cx="11" cy="12" r="2.6" fill="url(#pl-mark)" />
        <circle cx="21" cy="12" r="2.6" fill="url(#pl-mark)" opacity="0.55" />
        <circle cx="16" cy="21" r="2.6" fill="url(#pl-mark)" opacity="0.8" />
        <path d="M11 12 L16 21 L21 12" stroke="url(#pl-mark)" strokeWidth="1.2" opacity="0.5" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">
        AI Product<span className="text-muted"> Lab</span>
      </span>
    </span>
  );
}

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#personas", label: "Personas" },
  { href: "/pricing", label: "Pricing" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/80 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
      >
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="transition-colors hover:text-ink">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/dashboard"
          className="rounded-lg bg-gradient-to-r from-cyan to-violet px-4 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90"
        >
          Run a simulation
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo size={22} />
          <p className="max-w-md text-sm text-faint">
            Simulated users are a model of your product, not a substitute for talking to real
            ones. Every number in a report traces back to a specific line of your source.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <li>
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
          </li>
          <li>
            <Link href="/dashboard" className="hover:text-ink">
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/#how" className="hover:text-ink">
              How it works
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line px-6 py-20">
      <div className="mx-auto max-w-6xl">
        {eyebrow ? (
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-cyan">{eyebrow}</p>
        ) : null}
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        {lead ? <p className="mt-4 max-w-2xl text-lg text-muted">{lead}</p> : null}
        {children ? <div className="mt-12">{children}</div> : null}
      </div>
    </section>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-raised/60 p-6 ${className}`}>{children}</div>
  );
}
