import { prisma } from "@ballast/db";

const FREE_RETENTION_DAYS = 90;

/**
 * Nightly sweep: free-plan organizations keep 90 days of check history.
 * Paid plans keep everything. Cascade deletes take findings with the runs.
 */
export async function retentionSweep(): Promise<void> {
  const cutoff = new Date(Date.now() - FREE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.checkRun.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      project: { org: { plan: "FREE" } },
    },
  });
  if (result.count > 0) {
    console.log(`retention: deleted ${result.count} check runs older than ${FREE_RETENTION_DAYS}d (free plan)`);
  }
}
