import {
  QUEUES,
  type IngestCheckPayload,
  type RehearsalPayload,
} from "@ballast/db";
import PgBoss from "pg-boss";
import { env } from "./env.js";
import { ingestCheck } from "./jobs/ingest-check.js";
import { runRehearsal } from "./jobs/rehearsal.js";
import { retentionSweep } from "./jobs/retention.js";

async function main(): Promise<void> {
  const boss = new PgBoss({
    connectionString: env.databaseUrl,
    schema: "pgboss",
  });

  boss.on("error", (err) => console.error("pg-boss:", err));

  await boss.start();
  for (const queue of Object.values(QUEUES)) {
    await boss.createQueue(queue);
  }

  await boss.work<IngestCheckPayload>(
    QUEUES.ingestCheck,
    { batchSize: 5 },
    async (jobs) => {
      for (const job of jobs) await ingestCheck(job.data);
    },
  );

  await boss.work<RehearsalPayload>(
    QUEUES.rehearsal,
    { batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) await runRehearsal(job.data);
    },
  );

  await boss.work(QUEUES.retention, { batchSize: 1 }, async () => {
    await retentionSweep();
  });

  // 04:10 UTC daily — quiet hours for most of our traffic.
  await boss.schedule(QUEUES.retention, "10 4 * * *");

  console.log("ballast worker: listening", Object.values(QUEUES).join(", "));

  const shutdown = async (signal: string) => {
    console.log(`ballast worker: ${signal} received, draining…`);
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("ballast worker failed to start:", err);
  process.exit(1);
});
