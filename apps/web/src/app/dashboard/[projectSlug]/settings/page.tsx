import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@ballast/db";
import { ApiKeysPanel } from "@/components/dashboard/api-keys";
import { requireOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const org = await requireOrg();
  const project = await prisma.project.findUnique({
    where: { orgId_slug: { orgId: org.id, slug: projectSlug } },
    include: { apiKeys: { orderBy: { createdAt: "desc" } } },
  });
  if (!project) notFound();

  const keys = project.apiKeys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    lastUsedAt: k.lastUsedAt
      ? k.lastUsedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null,
    revoked: k.revokedAt !== null,
  }));

  return (
    <div>
      <p className="text-sm text-faint">
        <Link href="/dashboard" className="hover:text-muted">
          Projects
        </Link>{" "}
        /{" "}
        <Link href={`/dashboard/${project.slug}`} className="hover:text-muted">
          {project.name}
        </Link>{" "}
        /
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        Settings
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ApiKeysPanel projectSlug={project.slug} keys={keys} />

        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-medium text-ink">Project</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Preset</dt>
              <dd className="font-mono text-beacon-bright">{project.preset}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Repository</dt>
              <dd className="font-mono text-ink">
                {project.repository ?? "not linked"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Postgres version</dt>
              <dd className="text-ink">{project.pgVersion}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Default branch</dt>
              <dd className="font-mono text-ink">{project.defaultBranch}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-faint">
            Rule severities are controlled by ballast.config.json in your
            repository — policy lives in code, next to the migrations it
            governs, where changes get reviewed.
          </p>
        </div>
      </div>
    </div>
  );
}
