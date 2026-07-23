import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@ballast/db";
import { requireOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

const SEVERITY_STYLE: Record<string, string> = {
  blocker: "bg-danger/15 text-danger",
  warning: "bg-warn/15 text-warn",
  notice: "bg-indigo-soft/15 text-indigo-soft",
};

export default async function CheckDetailPage({
  params,
}: {
  params: Promise<{ projectSlug: string; checkId: string }>;
}) {
  const { projectSlug, checkId } = await params;
  const org = await requireOrg();
  const run = await prisma.checkRun.findFirst({
    where: {
      id: checkId,
      project: { orgId: org.id, slug: projectSlug },
    },
    include: {
      findings: { orderBy: [{ file: "asc" }, { line: "asc" }] },
      project: true,
    },
  });
  if (!run) notFound();

  return (
    <div>
      <p className="text-sm text-faint">
        <Link href="/dashboard" className="hover:text-muted">
          Projects
        </Link>{" "}
        /{" "}
        <Link href={`/dashboard/${projectSlug}`} className="hover:text-muted">
          {run.project.name}
        </Link>{" "}
        /
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Check {run.id.slice(-8)}
        </h1>
        <span
          className={`rounded-lg px-3 py-1 text-sm font-medium ${
            run.passed ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"
          }`}
        >
          {run.passed ? "PASS" : "FAIL"}
        </span>
        {run.status !== "COMPLETE" ? (
          <span className="rounded-lg bg-raised px-3 py-1 text-sm text-muted">
            {run.status === "QUEUED" ? "processing findings…" : "ingest failed"}
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Score", `${run.score}/100 (${run.grade})`],
          ["Statements", String(run.statements)],
          ["Branch", run.branch ?? "—"],
          ["Engine", `v${run.engineVersion}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-faint">{label}</p>
            <p className="mt-1 truncate font-medium text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {run.findings.length === 0 && run.status === "COMPLETE" ? (
          <div className="rounded-xl border border-ok/30 bg-ok/10 p-5 text-sm text-ok">
            No migration hazards found. Safe to ship.
          </div>
        ) : null}
        {run.findings.map((f) => {
          const fix = f.fix as {
            summary?: string;
            sql?: string;
            steps?: string[];
          } | null;
          return (
            <div key={f.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase ${SEVERITY_STYLE[f.severity] ?? "bg-raised text-muted"}`}
                >
                  {f.severity}
                </span>
                <code className="font-mono text-xs text-beacon-bright">
                  {f.ruleId}
                </code>
                <span className="font-mono text-xs text-faint">
                  {f.file}:{f.line}
                </span>
              </div>
              <p className="mt-2.5 text-sm text-ink">{f.message}</p>
              {f.why ? (
                <p className="mt-2 text-xs leading-relaxed text-muted">{f.why}</p>
              ) : null}
              <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-abyss p-3 font-mono text-xs text-muted">
                {f.statement}
              </pre>
              {fix?.summary ? (
                <div className="mt-3 rounded-lg border border-line bg-abyss p-3">
                  <p className="text-xs font-medium text-ok">Fix: {fix.summary}</p>
                  {fix.sql ? (
                    <code className="mt-1.5 block overflow-x-auto font-mono text-xs text-beacon-bright">
                      {fix.sql}
                    </code>
                  ) : null}
                  {fix.steps?.map((step) => (
                    <p key={step} className="mt-1.5 text-xs text-muted">
                      • {step}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
