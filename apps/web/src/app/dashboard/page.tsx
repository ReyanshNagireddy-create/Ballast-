import Link from "next/link";
import { prisma } from "@ballast/db";
import { requireOrg } from "@/lib/org";
import { createProject } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const org = await requireOrg();
  const projects = await prisma.project.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "asc" },
    include: {
      checkRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { checkRuns: true } },
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted">
            {org.name} · {org.plan === "FREE" ? "Free plan" : "Team plan"}
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-10 text-center">
          <h2 className="text-lg font-medium text-ink">
            Create your first project
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            A project holds one repository&rsquo;s check history. After
            creating it, generate an API key in settings and add{" "}
            <code className="font-mono text-beacon-bright">--upload</code> to
            your CI check.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {projects.map((p) => {
            const last = p.checkRuns[0];
            return (
              <Link
                key={p.id}
                href={`/dashboard/${p.slug}`}
                className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-beacon/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-medium text-ink group-hover:text-beacon-bright">
                    {p.name}
                  </h2>
                  <span className="rounded bg-raised px-2 py-0.5 font-mono text-[11px] text-muted">
                    {p.preset}
                  </span>
                </div>
                <p className="mt-1 text-xs text-faint">
                  {p.repository ?? "No repository linked"} ·{" "}
                  {p._count.checkRuns} checks
                </p>
                {last ? (
                  <p className="mt-3 text-sm">
                    <span
                      className={
                        last.passed ? "text-ok" : "text-danger"
                      }
                    >
                      {last.passed ? "PASS" : "FAIL"}
                    </span>{" "}
                    <span className="text-muted">
                      · score {last.score}/100 ({last.grade}) ·{" "}
                      {last.branch ?? "no branch"}
                    </span>
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-faint">No checks yet</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-line bg-surface p-6">
        <h2 className="font-medium text-ink">New project</h2>
        <form action={createProject} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="api-server"
            className="rounded-lg border border-line bg-abyss px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-beacon/50 focus:outline-none"
          />
          <select
            name="preset"
            defaultValue="prisma"
            className="rounded-lg border border-line bg-abyss px-3 py-2 text-sm text-ink focus:border-beacon/50 focus:outline-none"
          >
            {["prisma", "raw", "django", "rails", "drizzle", "flyway", "goose", "golang-migrate"].map(
              (p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ),
            )}
          </select>
          <input
            name="repository"
            placeholder="acme/api-server (optional)"
            className="rounded-lg border border-line bg-abyss px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-beacon/50 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-beacon px-4 py-2 text-sm font-medium text-abyss transition-colors hover:bg-beacon-bright"
          >
            Create project
          </button>
        </form>
      </div>
    </div>
  );
}
