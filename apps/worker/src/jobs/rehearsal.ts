import { splitStatements } from "@ballast/core";
import { prisma, type RehearsalPayload } from "@ballast/db";
import pg from "pg";
import { env } from "../env.js";

interface StatementTiming {
  statement: string;
  ms: number;
}

/**
 * Applies a migration to a disposable schema on the rehearsal database and
 * records per-statement wall-clock timings. This is deliberately a rehearsal,
 * not a simulation: the statements really execute, so lock behavior, rewrite
 * cost, and syntax errors surface before production does the same work.
 *
 * The rehearsal database should be seeded production-shaped (same schema,
 * representative row counts) — see docs/rehearsals.md.
 */
export async function runRehearsal(payload: RehearsalPayload): Promise<void> {
  const rehearsal = await prisma.rehearsalRun.findUnique({
    where: { id: payload.rehearsalId },
  });
  if (!rehearsal || rehearsal.status !== "QUEUED") return;

  const connectionString = env.rehearsalDatabaseUrl;
  if (!connectionString) {
    await prisma.rehearsalRun.update({
      where: { id: rehearsal.id },
      data: {
        status: "FAILED",
        error:
          "REHEARSAL_DATABASE_URL is not configured. Point it at a disposable, production-shaped database.",
        finishedAt: new Date(),
      },
    });
    return;
  }

  await prisma.rehearsalRun.update({
    where: { id: rehearsal.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const schema = `rehearsal_${rehearsal.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const client = new pg.Client({ connectionString });
  const timings: StatementTiming[] = [];

  try {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    // Fail fast on contention rather than hanging the worker.
    await client.query(`SET lock_timeout = '30s'`);
    await client.query(`SET statement_timeout = '15min'`);

    const { statements } = splitStatements(rehearsal.sql);
    for (const stmt of statements) {
      const started = process.hrtime.bigint();
      await client.query(stmt.sql);
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      timings.push({
        statement:
          stmt.sql.length > 300 ? `${stmt.sql.slice(0, 299)}…` : stmt.sql,
        ms: Math.round(ms * 100) / 100,
      });
    }

    await prisma.rehearsalRun.update({
      where: { id: rehearsal.id },
      data: {
        status: "SUCCEEDED",
        timings: timings as unknown as object,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.rehearsalRun.update({
      where: { id: rehearsal.id },
      data: {
        status: "FAILED",
        timings: timings as unknown as object,
        error: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    });
  } finally {
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } catch {
      // Schema cleanup is best-effort; the rehearsal DB is disposable.
    }
    await client.end();
  }
}
