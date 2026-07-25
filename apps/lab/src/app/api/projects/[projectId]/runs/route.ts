import { NextResponse } from "next/server";
import { z } from "zod";
import { executeRun } from "@/lib/run";
import { getProject, listRuns } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  personaCount: z.number().int().optional(),
  /** Change the seed to draw a different cohort; keep it to reproduce a run. */
  seed: z.number().int().optional(),
});

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ runs: await listRuns(projectId) });
}

/** Re-run the simulation against the project's stored source. */
export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  let options: z.infer<typeof body> = {};
  try {
    const raw = await request.text();
    if (raw.trim().length > 0) options = body.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const previous = await listRuns(projectId);
  const run = await executeRun({
    projectId,
    projectName: project.name,
    files: project.files,
    ...(options.personaCount !== undefined ? { personaCount: options.personaCount } : {}),
    // A re-run with the same seed reproduces the same cohort; without one, walk
    // the seed forward so "run it again" draws different people.
    seed: options.seed ?? previous.length + 1,
  });

  return NextResponse.json(
    { runId: run.id, status: run.status, error: run.error },
    { status: run.status === "failed" ? 500 : 201 },
  );
}
