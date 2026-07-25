import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Report, SourceFile } from "@productlab/engine";

/**
 * A file-backed store.
 *
 * Deliberately not a database. The MVP has to run with `npm run dev` and
 * nothing else installed, and the shape below is the shape a Postgres schema
 * would take, so moving to one later is a swap rather than a rewrite.
 */

export type ProjectSource =
  | { kind: "demo" }
  | { kind: "zip"; filename: string }
  | { kind: "github"; repo: string; ref: string };

export interface Project {
  id: string;
  name: string;
  source: ProjectSource;
  createdAt: string;
  fileCount: number;
}

export type RunStatus = "running" | "complete" | "failed";

export interface Run {
  id: string;
  projectId: string;
  status: RunStatus;
  personaCount: number;
  seed: number;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  report?: Report;
  error?: string;
}

const ROOT = process.env.PRODUCTLAB_DATA_DIR ?? join(process.cwd(), ".productlab");
const PROJECTS = join(ROOT, "projects");
const RUNS = join(ROOT, "runs");

async function ensureDirs(): Promise<void> {
  await mkdir(PROJECTS, { recursive: true });
  await mkdir(RUNS, { recursive: true });
}

/** Ids are user-visible in URLs, so keep them short and unambiguous. */
export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

/* ──────────────────────────────── projects ─────────────────────────────── */

interface StoredProject extends Project {
  files: SourceFile[];
}

export async function saveProject(
  project: Omit<Project, "fileCount">,
  files: SourceFile[],
): Promise<Project> {
  await ensureDirs();
  const stored: StoredProject = { ...project, fileCount: files.length, files };
  await writeFile(join(PROJECTS, `${project.id}.json`), JSON.stringify(stored), "utf8");
  const { files: _files, ...meta } = stored;
  return meta;
}

export async function getProject(id: string): Promise<StoredProject | null> {
  if (!isSafeId(id)) return null;
  try {
    const text = await readFile(join(PROJECTS, `${id}.json`), "utf8");
    return JSON.parse(text) as StoredProject;
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<Project[]> {
  await ensureDirs();
  const entries = await readdir(PROJECTS).catch(() => [] as string[]);
  const projects: Project[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const project = await getProject(entry.replace(/\.json$/, ""));
    if (!project) continue;
    const { files: _files, ...meta } = project;
    projects.push(meta);
  }
  projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return projects;
}

/* ────────────────────────────────── runs ───────────────────────────────── */

export async function saveRun(run: Run): Promise<Run> {
  await ensureDirs();
  await writeFile(join(RUNS, `${run.id}.json`), JSON.stringify(run), "utf8");
  return run;
}

export async function getRun(id: string): Promise<Run | null> {
  if (!isSafeId(id)) return null;
  try {
    return JSON.parse(await readFile(join(RUNS, `${id}.json`), "utf8")) as Run;
  } catch {
    return null;
  }
}

/** Runs for one project, newest first. Reports are dropped to keep this light. */
export async function listRuns(projectId?: string): Promise<Omit<Run, "report">[]> {
  await ensureDirs();
  const entries = await readdir(RUNS).catch(() => [] as string[]);
  const runs: Omit<Run, "report">[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const run = await getRun(entry.replace(/\.json$/, ""));
    if (!run) continue;
    if (projectId && run.projectId !== projectId) continue;
    const { report: _report, ...meta } = run;
    runs.push(meta);
  }
  runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return runs;
}

/** Summary line for a run listing, without loading the whole report. */
export async function latestRunFor(projectId: string): Promise<Run | null> {
  const runs = await listRuns(projectId);
  const newest = runs[0];
  return newest ? getRun(newest.id) : null;
}

/**
 * Ids come out of the URL and are used to build a file path, so anything that
 * is not a plain id is rejected outright rather than normalised.
 */
function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}
