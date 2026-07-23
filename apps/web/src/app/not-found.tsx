import Link from "next/link";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-32 text-center">
        <p className="font-mono text-sm text-beacon">ERROR 404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
          This page was dropped without a migration plan
        </h1>
        <p className="mt-3 max-w-md text-muted">
          Exactly the kind of thing we warn about. Let&rsquo;s get you back to
          somewhere that exists.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="rounded-lg bg-beacon px-5 py-2.5 text-sm font-medium text-abyss transition-colors hover:bg-beacon-bright"
          >
            Home
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-beacon/40"
          >
            Documentation
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
