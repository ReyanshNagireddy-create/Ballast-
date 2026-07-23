import Link from "next/link";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { DOC_PAGES } from "@/lib/docs-content";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <div className="mx-auto flex max-w-6xl gap-10 px-5 pb-24 pt-10">
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1" aria-label="Documentation">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-faint">
              Documentation
            </p>
            <Link
              href="/docs"
              className="block rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              Overview
            </Link>
            {DOC_PAGES.map((p) => (
              <Link
                key={p.slug}
                href={`/docs/${p.slug}`}
                className="block rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                {p.title}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <Footer />
    </>
  );
}
