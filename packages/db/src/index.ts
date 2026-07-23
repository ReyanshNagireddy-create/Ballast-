import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __ballastPrisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client. Next.js hot-reload re-evaluates modules; caching on
 * globalThis prevents connection-pool exhaustion in development.
 */
export const prisma: PrismaClient =
  globalThis.__ballastPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__ballastPrisma = prisma;
}

export * from "@prisma/client";
export * from "./queues.js";
