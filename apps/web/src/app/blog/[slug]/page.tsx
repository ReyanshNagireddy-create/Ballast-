import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocBlocks } from "@/components/doc-blocks";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-content";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16">
        <article>
          <time dateTime={post.date} className="text-sm text-faint">
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-sm text-muted">{post.author}</p>
          <div className="mt-10">
            <DocBlocks blocks={post.blocks} />
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
