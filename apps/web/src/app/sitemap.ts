import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog-content";
import { DOC_PAGES } from "@/lib/docs-content";
import { SITE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/pricing",
    "/playground",
    "/docs",
    "/blog",
    "/changelog",
    "/careers",
    "/contact",
    "/legal/privacy",
    "/legal/terms",
  ].map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const docs = DOC_PAGES.map((p) => ({
    url: `${SITE.url}/docs/${p.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const posts = BLOG_POSTS.map((p) => ({
    url: `${SITE.url}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...docs, ...posts];
}
