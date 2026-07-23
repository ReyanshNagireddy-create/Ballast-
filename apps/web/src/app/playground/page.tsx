import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { PlaygroundClient } from "@/components/playground-client";
import { SectionHeading } from "@/components/section";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Paste a Postgres migration and see what Ballast catches — locking hazards, table rewrites, and downtime risks, analyzed live.",
};

export default function PlaygroundPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-16">
        <SectionHeading
          eyebrow="Playground"
          title="Would your last migration have passed?"
          lead="Paste any migration below. The full engine runs server-side — same rules, same fixes as CI."
        />
        <div className="mt-12">
          <PlaygroundClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
