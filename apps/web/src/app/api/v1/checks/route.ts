import { NextResponse, type NextRequest } from "next/server";
import { prisma, QUEUES } from "@ballast/db";
import { authenticateApiKey, unauthorized } from "@/lib/api-auth";
import { enqueue } from "@/lib/boss";
import { checkUploadSchema } from "@/lib/report-schema";
import { SITE } from "@/lib/seo";

export const runtime = "nodejs";

/**
 * POST /api/v1/checks — store a check run for the key's project.
 * Summary numbers are written synchronously; finding expansion and GitHub
 * annotation posting are handled by the worker.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const authed = await authenticateApiKey(req);
  if (!authed) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be JSON." },
      { status: 400 },
    );
  }
  const parsed = checkUploadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "Body must be { report, meta? }.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { report, meta } = parsed.data;
  const checkRun = await prisma.checkRun.create({
    data: {
      projectId: authed.project.id,
      source: "API",
      status: "QUEUED",
      branch: meta?.branch ?? null,
      commitSha: meta?.commit ?? null,
      repository: meta?.repository ?? authed.project.repository,
      runUrl: meta?.runUrl ?? null,
      engineVersion: report.version,
      files: report.summary.files,
      statements: report.summary.statements,
      blockers: report.summary.blockers,
      warnings: report.summary.warnings,
      notices: report.summary.notices,
      score: report.summary.score,
      grade: report.summary.grade,
      passed: report.summary.passed,
    },
  });

  await enqueue(QUEUES.ingestCheck, { checkRunId: checkRun.id, report });

  return NextResponse.json(
    {
      id: checkRun.id,
      url: `${SITE.url}/dashboard/${authed.project.slug}/checks/${checkRun.id}`,
    },
    { status: 201 },
  );
}

/** GET /api/v1/checks — list runs for the key's project (cursor pagination). */
export async function GET(req: NextRequest): Promise<Response> {
  const authed = await authenticateApiKey(req);
  if (!authed) return unauthorized();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 20) || 20, 1),
    100,
  );
  const cursor = searchParams.get("cursor");

  const runs = await prisma.checkRun.findMany({
    where: { projectId: authed.project.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = runs.length > limit;
  const page = hasMore ? runs.slice(0, limit) : runs;
  return NextResponse.json({
    checks: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}
