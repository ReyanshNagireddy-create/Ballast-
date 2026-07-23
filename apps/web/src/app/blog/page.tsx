import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { BLOG_POSTS } from "@/lib/blog-content";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Engineering notes on Postgres lock semantics, migration safety, and building Ballast.",
};

export default function BlogIndexPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Blog</h1>
        <p className="mt-3 text-muted">
          Engineering notes on Postgres lock semantics, migration safety, and
          building Ballast.
        </p>
        <div className="mt-12 space-y-6">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-xl border border-line bg-surface p-6 transition-colors hover:border-beacon/40"
            >
              <time dateTime={post.date} className="text-xs text-faint">
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <h2 className="mt-2 text-xl font-medium text-ink group-hover:text-beacon-bright">
                {post.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {post.description}
              </p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
