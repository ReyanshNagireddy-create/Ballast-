import { NextResponse } from "next/server";
import { z } from "zod";
import type { SourceFile } from "@productlab/engine";
import { ArchiveError, fetchGithubRepo, readZip } from "@/lib/archive";
import { DEMO_PROJECT_NAME, loadDemoProject } from "@/lib/demo";
import { executeRun } from "@/lib/run";
import { listProjects, newId, saveProject, type ProjectSource } from "@/lib/store";

export const runtime = "nodejs";
/** Uploads and repository fetches are not cacheable. */
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const githubBody = z.object({
  kind: z.literal("github"),
  repo: z.string().min(3).max(200),
  ref: z.string().min(1).max(120).optional(),
  name: z.string().max(120).optional(),
  personaCount: z.number().int().optional(),
});

const demoBody = z.object({
  kind: z.literal("demo"),
  personaCount: z.number().int().optional(),
});

export async function GET() {
  return NextResponse.json({ projects: await listProjects() });
}

/**
 * Create a project from a demo, a GitHub repository, or an uploaded ZIP, then
 * immediately run the first simulation — an empty project is not useful to
 * anyone, and the whole promise of the product is "upload and see".
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const created = contentType.includes("multipart/form-data")
      ? await fromUpload(request)
      : await fromJson(request);

    const project = await saveProject(
      {
        id: newId("prj"),
        name: created.name,
        source: created.source,
        createdAt: new Date().toISOString(),
      },
      created.files,
    );

    const run = await executeRun({
      projectId: project.id,
      projectName: project.name,
      files: created.files,
      ...(created.personaCount !== undefined ? { personaCount: created.personaCount } : {}),
    });

    return NextResponse.json({ project, runId: run.id, status: run.status }, { status: 201 });
  } catch (error) {
    if (error instanceof ArchiveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not create the project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

interface CreatedProject {
  name: string;
  source: ProjectSource;
  files: SourceFile[];
  personaCount?: number;
}

async function fromJson(request: Request): Promise<CreatedProject> {
  const body = await request.json();
  const parsed = z.union([githubBody, demoBody]).parse(body);

  if (parsed.kind === "demo") {
    return {
      name: DEMO_PROJECT_NAME,
      source: { kind: "demo" },
      files: await loadDemoProject(),
      ...(parsed.personaCount !== undefined ? { personaCount: parsed.personaCount } : {}),
    };
  }

  const { files, repo, ref } = await fetchGithubRepo(parsed.repo, parsed.ref ?? "HEAD");
  return {
    name: parsed.name || repo,
    source: { kind: "github", repo, ref },
    files,
    ...(parsed.personaCount !== undefined ? { personaCount: parsed.personaCount } : {}),
  };
}

async function fromUpload(request: Request): Promise<CreatedProject> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ArchiveError("No file was uploaded. Attach a .zip of your project.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ArchiveError(`That ZIP is ${Math.round(file.size / 1024 / 1024)} MB; the limit is 25 MB.`);
  }

  const files = readZip(Buffer.from(await file.arrayBuffer()));
  if (files.length === 0) {
    throw new ArchiveError("That ZIP contains no JavaScript or TypeScript source to analyse.");
  }

  const rawName = form.get("name");
  const rawCount = form.get("personaCount");
  const personaCount = typeof rawCount === "string" ? Number(rawCount) : undefined;

  return {
    name: (typeof rawName === "string" && rawName.trim()) || file.name.replace(/\.zip$/i, ""),
    source: { kind: "zip", filename: file.name },
    files,
    ...(personaCount !== undefined && Number.isFinite(personaCount) ? { personaCount } : {}),
  };
}
