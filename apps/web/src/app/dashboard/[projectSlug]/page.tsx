import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@ballast/db";
import { requireOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const org = await requireOrg();
  const project = await prisma.project.findUnique({
    where: { orgId_slug: { orgId: org.id, slug: projectSlug } },
    include: {
      checkRuns: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!project) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-faint">
            <Link href="/dashboard" className="hover:text-muted">
              Projects
            </Link>{" "}
            /
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {project.name}
          </h1>
        </div>
        <Link
          href={`/dashboard/${project.slug}/settings`}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-beacon/40"
        >
          Settings
        </Link>
      </div>

      {project.checkRuns.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-10">
          <h2 className="text-lg font-medium text-ink">
            Waiting for the first check
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Create an API key in settings, then upload from CI:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-abyss p-4 font-mono text-[13px] text-beacon-bright">
            {`export BALLAST_API_KEY=blt_live_...\nnpx @ballast/cli check --upload`}
          </pre>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface">
              <tr>
                <th className="px-4 py-3 font-medium text-ink">Result</th>
                <th className="px-4 py-3 font-medium text-ink">Score</th>
                <th className="px-4 py-3 font-medium text-ink">Findings</th>
                <th className="px-4 py-3 font-medium text-ink">Branch</th>
                <th className="px-4 py-3 font-medium text-ink">Commit</th>
                <th className="px-4 py-3 font-medium text-ink">When</th>
              </tr>
            </thead>
            <tbody>
              {project.checkRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-line transition-colors last:border-0 hover:bg-surface/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/${project.slug}/checks/${run.id}`}
                      className={`font-medium ${run.passed ? "text-ok" : "text-danger"}`}
                    >
                      {run.passed ? "PASS" : "FAIL"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {run.score}/100 ({run.grade})
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {run.blockers > 0 && (
                      <span className="text-danger">{run.blockers}B </span>
                    )}
                    {run.warnings > 0 && (
                      <span className="text-warn">{run.warnings}W </span>
                    )}
                    {run.notices > 0 && (
                      <span className="text-indigo-soft">{run.notices}N</span>
                    )}
                    {run.blockers + run.warnings + run.notices === 0 && "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {run.branch ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {run.commitSha ? run.commitSha.slice(0, 7) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-faint">
                    {run.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
