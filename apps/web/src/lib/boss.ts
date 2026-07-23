import PgBoss from "pg-boss";

declare global {
  // eslint-disable-next-line no-var
  var __ballastBoss: Promise<PgBoss> | undefined;
}

/**
 * Send-only pg-boss instance for enqueueing jobs from API routes. The worker
 * owns queue consumption; this side only publishes.
 */
export function getBoss(): Promise<PgBoss> {
  if (!globalThis.__ballastBoss) {
    globalThis.__ballastBoss = (async () => {
      const boss = new PgBoss({
        connectionString: process.env.DATABASE_URL,
        schema: "pgboss",
      });
      boss.on("error", (err) => console.error("pg-boss (web):", err));
      await boss.start();
      return boss;
    })();
  }
  return globalThis.__ballastBoss;
}

/** Enqueues a job, ensuring the queue exists (idempotent). */
export async function enqueue(
  queue: string,
  data: object,
): Promise<string | null> {
  const boss = await getBoss();
  await boss.createQueue(queue);
  return boss.send(queue, data);
}
