import type { Metadata } from "next";
import Link from "next/link";
import { DOC_PAGES } from "@/lib/docs-content";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Everything about Ballast: quickstart, rules reference, CI setup, cloud, rehearsals, self-hosting, and the API.",
};

export default function DocsIndexPage() {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Documentation
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        Ballast is the safety layer for Postgres migrations: a deterministic
        engine that catches locking hazards, table rewrites, and downtime risks
        in CI. Start with the quickstart — you&rsquo;ll have a gated check in
        about two minutes.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {DOC_PAGES.map((p) => (
          <Link
            key={p.slug}
            href={`/docs/${p.slug}`}
            className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-beacon/40"
          >
            <h2 className="font-medium text-ink group-hover:text-beacon-bright">
              {p.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {p.description}
            </p>
          </Link>
        ))}
      </div>
    </article>
  );
}
