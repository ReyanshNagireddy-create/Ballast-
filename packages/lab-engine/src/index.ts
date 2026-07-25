import { buildProjectModel } from "./ingest.js";
import { enrichReport, llmConfigFromEnv, type LlmConfig } from "./llm.js";
import { generatePersonas } from "./personas.js";
import { buildReport } from "./report.js";
import { readProjectFromDisk, type SourceFile } from "./source.js";
import { simulate } from "./simulate.js";
import {
  DEFAULT_SIMULATION_CONFIG,
  type Persona,
  type ProjectModel,
  type Report,
  type Session,
  type SimulationConfig,
} from "./types.js";

export * from "./types.js";
export { Rng, hashString } from "./random.js";
export { buildProjectModel, detectFramework, findRouteFiles, routePathFor } from "./ingest.js";
export { readProjectFromDisk, type SourceFile } from "./source.js";
export { ARCHETYPES, deriveGoals, describePersona, deviceLabel, generatePersonas } from "./personas.js";
export { FRICTION, causeCategory, readableCause, type FrictionCause } from "./friction.js";
export { formatMs, labelRelevance, loadTimeMs, simulate, simulateSession } from "./simulate.js";
export { quoteFor } from "./quotes.js";
export {
  buildFunnel,
  buildReport,
  predictAdoption,
  projectBusiness,
  recommend,
  scoreProduct,
  synthesiseIssues,
} from "./report.js";
export { enrichReport, llmConfigFromEnv, type LlmConfig } from "./llm.js";

export interface RunResult {
  model: ProjectModel;
  personas: Persona[];
  sessions: Session[];
  report: Report;
}

export interface RunOptions extends Partial<SimulationConfig> {
  /** Display name for the project. Defaults to the directory or package name. */
  name?: string;
  runId?: string;
  /** Pass `null` to skip enrichment even when the environment configures a model. */
  llm?: LlmConfig | null;
}

/**
 * Run a full simulation over an already-loaded source tree.
 *
 * Deterministic: the same files, persona count, and seed always produce the
 * same report, which is what makes two runs comparable across a code change.
 */
export async function runSimulation(
  files: SourceFile[],
  options: RunOptions = {},
): Promise<RunResult> {
  const config: SimulationConfig = {
    personaCount: options.personaCount ?? DEFAULT_SIMULATION_CONFIG.personaCount,
    seed: options.seed ?? DEFAULT_SIMULATION_CONFIG.seed,
    maxStepsPerSession: options.maxStepsPerSession ?? DEFAULT_SIMULATION_CONFIG.maxStepsPerSession,
  };

  const model = buildProjectModel(files, options.name ?? "Untitled project");
  const personas = generatePersonas(model, config.personaCount, config.seed);
  const sessions = simulate(model, personas, config);
  const base = buildReport(model, personas, sessions, {
    runId: options.runId ?? `run_${Date.now().toString(36)}`,
    seed: config.seed,
  });

  const llm = options.llm === undefined ? llmConfigFromEnv() : options.llm;
  const report = await enrichReport(base, llm);

  return { model, personas, sessions, report };
}

/** Convenience wrapper: read a directory from disk, then simulate it. */
export async function runSimulationOnDirectory(
  directory: string,
  options: RunOptions = {},
): Promise<RunResult> {
  const files = await readProjectFromDisk(directory);
  const name = options.name ?? directory.split("/").filter(Boolean).pop() ?? "Untitled project";
  return runSimulation(files, { ...options, name });
}
