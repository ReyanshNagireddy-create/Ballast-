import { prisma, type IngestCheckPayload } from "@ballast/db";
import { publishGithubCheck } from "../github.js";

/**
 * Expands a queued CheckRun into persisted findings and finalizes it.
 * The API route stores summary numbers synchronously (so the dashboard list
 * is instantly correct) and defers the potentially large finding expansion
 * and GitHub annotation round-trips to this job.
 */
export async function ingestCheck(payload: IngestCheckPayload): Promise<void> {
  const { checkRunId, report } = payload;

  const checkRun = await prisma.checkRun.findUnique({
    where: { id: checkRunId },
  });
  if (!checkRun) {
    // Deleted before we got to it (project removed, retention) — nothing to do.
    return;
  }
  if (checkRun.status === "COMPLETE") return; // idempotent re-delivery

  try {
    await prisma.$transaction([
      prisma.finding.deleteMany({ where: { checkRunId } }),
      prisma.finding.createMany({
        data: report.findings.map((f) => ({
          checkRunId,
          ruleId: f.ruleId,
          severity: f.severity,
          category: f.category,
          message: f.message,
          why: f.why,
          file: f.file,
          line: f.line,
          statement: f.statement,
          fix: f.fix ?? undefined,
        })),
      }),
      prisma.checkRun.update({
        where: { id: checkRunId },
        data: { status: "COMPLETE" },
      }),
    ]);
  } catch (err) {
    await prisma.checkRun.update({
      where: { id: checkRunId },
      data: { status: "FAILED" },
    });
    throw err;
  }

  await publishGithubCheck(payload, {
    repository: checkRun.repository,
    commitSha: checkRun.commitSha,
  });
}
