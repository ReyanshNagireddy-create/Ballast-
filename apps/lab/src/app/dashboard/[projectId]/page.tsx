import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Nav } from "@/components/chrome";
import { RerunButton } from "@/components/rerun-button";
import { bandFor, VIZ } from "@/components/viz";
import { getProject, getRun, listRuns } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const runs = await listRuns(projectId);
  const detailed = await Promise.all(runs.map((run) => getRun(run.id)));
  const latestCount = runs[0]?.personaCount ?? 100;

  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-5xl px-6 py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-faint">
          <Link href="/dashboard" className="hover:text-ink">
            Projects
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-muted">{project.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-2 font-mono text-sm text-faint">
              {project.fileCount} source files · {runs.length} run{runs.length === 1 ? "" : "s"}
            </p>
          </div>
          <RerunButton projectId={projectId} personaCount={latestCount} />
        </div>

        <h2 className="mb-4 mt-12 text-lg font-semibold">Run history</h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-bright p-10 text-center text-muted">
            No runs recorded for this project yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {detailed.map((run) => {
              if (!run) return null;
              const score = run.report?.scores.overall;
              const band = score === undefined ? null : bandFor(score);
              return (
                <li key={run.id}>
                  <Link
                    href={`/dashboard/${projectId}/runs/${run.id}`}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-raised/50 px-5 py-4 transition-colors hover:border-line-bright"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-ink">{run.id}</p>
                      <p className="mt-1 text-xs text-faint">
                        {run.personaCount} personas · seed {run.seed} ·{" "}
                        {new Date(run.createdAt).toLocaleString("en-GB")}
                        {run.durationMs !== undefined ? ` · ${run.durationMs}ms` : ""}
                      </p>
                    </div>
                    {run.status === "complete" && score !== undefined && band ? (
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="font-mono text-sm tabular-nums text-muted">
                            {run.report?.outcomes.success ?? 0}/{run.personaCount}
                          </p>
                          <p className="text-xs text-faint">finished the task</p>
                        </div>
                        <div>
                          <p className="font-mono text-xl tabular-nums" style={{ color: VIZ.status[band] }}>
                            {score}
                          </p>
                          <p className="text-xs text-faint">score</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-poor">{run.error ?? "Failed"}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
