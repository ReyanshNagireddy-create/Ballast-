import Link from "next/link";
import type { Metadata } from "next";
import { Footer, Nav } from "@/components/chrome";
import { NewProject } from "@/components/new-project";
import { bandFor, VIZ } from "@/components/viz";
import { latestRunFor, listProjects } from "@/lib/store";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projects = await listProjects();
  const rows = await Promise.all(
    projects.map(async (project) => ({ project, latest: await latestRunFor(project.id) })),
  );

  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 text-muted">
            Every run is stored with its seed, so you can re-run the same cohort after a change and
            compare like for like.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading" className="sr-only">
              Your projects
            </h2>

            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-bright bg-raised/30 p-12 text-center">
                <p className="text-lg text-ink">Nothing simulated yet.</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Start with the bundled sample project — it takes about thirty seconds and produces
                  a report with genuine problems in it.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {rows.map(({ project, latest }) => {
                  const score = latest?.report?.scores.overall;
                  const band = score === undefined ? null : bandFor(score);
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/dashboard/${project.id}`}
                        className="block rounded-2xl border border-line bg-raised/50 p-5 transition-colors hover:border-line-bright"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-medium text-ink">{project.name}</p>
                            <p className="mt-1 font-mono text-xs text-faint">
                              {describeSource(project.source)} · {project.fileCount} files ·{" "}
                              {formatDate(project.createdAt)}
                            </p>
                          </div>
                          {score !== undefined && band ? (
                            <div className="text-right">
                              <p
                                className="font-mono text-2xl tabular-nums"
                                style={{ color: VIZ.status[band] }}
                              >
                                {score}
                              </p>
                              <p className="text-xs text-faint">product score</p>
                            </div>
                          ) : (
                            <p className="text-sm text-faint">
                              {latest?.status === "failed" ? "Last run failed" : "No runs yet"}
                            </p>
                          )}
                        </div>

                        {latest?.report ? (
                          <p className="mt-4 line-clamp-2 text-sm text-muted">
                            {latest.report.business.primaryLeak}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="lg:sticky lg:top-24">
            <NewProject />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function describeSource(source: { kind: string; repo?: string; filename?: string }): string {
  if (source.kind === "github") return source.repo ?? "GitHub";
  if (source.kind === "zip") return source.filename ?? "Upload";
  return "Sample project";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
