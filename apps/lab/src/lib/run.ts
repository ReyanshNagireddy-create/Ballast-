import { runSimulation, type SourceFile } from "@productlab/engine";
import { newId, saveRun, type Run } from "./store";

/** Free-plan ceiling; Pro raises it. Enforced server-side, not in the form. */
export const MAX_PERSONAS = 1_000;
export const DEFAULT_PERSONAS = 100;

export interface RunRequest {
  projectId: string;
  projectName: string;
  files: SourceFile[];
  personaCount?: number;
  seed?: number;
}

/**
 * Execute a simulation and persist the result.
 *
 * Runs inline: a 100-persona cohort over a small app takes tens of
 * milliseconds, and a queue would be infrastructure pretending to be progress.
 * The `Run` record carries a status field so moving this behind a worker later
 * does not change the read path.
 */
export async function executeRun(request: RunRequest): Promise<Run> {
  const personaCount = clampPersonas(request.personaCount);
  const seed = request.seed ?? 1;
  const id = newId("run");
  const startedAt = Date.now();

  const base: Run = {
    id,
    projectId: request.projectId,
    status: "running",
    personaCount,
    seed,
    createdAt: new Date().toISOString(),
  };

  try {
    const { report } = await runSimulation(request.files, {
      name: request.projectName,
      personaCount,
      seed,
      runId: id,
    });
    return saveRun({
      ...base,
      status: "complete",
      report,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return saveRun({
      ...base,
      status: "failed",
      error: error instanceof Error ? error.message : "Simulation failed.",
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    });
  }
}

export function clampPersonas(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PERSONAS;
  return Math.min(MAX_PERSONAS, Math.max(10, Math.round(parsed)));
}
