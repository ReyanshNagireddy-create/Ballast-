import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ALL_RULES } from "@ballast/core";
import { DocBlocks } from "@/components/doc-blocks";
import { DOC_PAGES, getDocPage } from "@/lib/docs-content";

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) return {};
  return { title: page.title, description: page.description };
}

const SEVERITY_STYLE: Record<string, string> = {
  blocker: "bg-danger/15 text-danger",
  warning: "bg-warn/15 text-warn",
  notice: "bg-indigo-soft/15 text-indigo-soft",
};

function RulesReference() {
  return (
    <div className="mt-10 space-y-6">
      {ALL_RULES.map((rule) => (
        <section
          key={rule.meta.id}
          id={rule.meta.slug}
          className="scroll-mt-24 rounded-xl border border-line bg-surface p-6"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <code className="font-mono text-sm text-beacon-bright">
              {rule.meta.id}
            </code>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase ${SEVERITY_STYLE[rule.meta.defaultSeverity]}`}
            >
              {rule.meta.defaultSeverity}
            </span>
            <span className="rounded bg-raised px-2 py-0.5 text-[11px] text-muted">
              {rule.meta.category}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-medium text-ink">
            {rule.meta.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {rule.meta.why}
          </p>
        </section>
      ))}
    </div>
  );
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) notFound();

  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        {page.title}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        {page.description}
      </p>
      {page.slug === "rules" ? (
        <RulesReference />
      ) : (
        <div className="mt-10">
          <DocBlocks blocks={page.blocks} />
        </div>
      )}
    </article>
  );
}
