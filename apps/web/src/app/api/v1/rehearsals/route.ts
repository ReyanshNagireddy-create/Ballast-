import { NextResponse, type NextRequest } from "next/server";
import { prisma, QUEUES } from "@ballast/db";
import { z } from "zod";
import { authenticateApiKey, unauthorized } from "@/lib/api-auth";
import { enqueue } from "@/lib/boss";

export const runtime = "nodejs";

const bodySchema = z.object({
  sql: z.string().min(1).max(512 * 1024),
  checkRunId: z.string().max(64).optional(),
});

/** POST /api/v1/rehearsals — queue a migration rehearsal (Team plan). */
export async function POST(req: NextRequest): Promise<Response> {
  const authed = await authenticateApiKey(req);
  if (!authed) return unauthorized();

  if (authed.project.org.plan === "FREE") {
    return NextResponse.json(
      {
        error: "plan_required",
        message:
          "Rehearsals are a Team feature. Upgrade in the dashboard, or self-host the worker with REHEARSAL_DATABASE_URL.",
      },
      { status: 402 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be JSON." },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Body must be { sql, checkRunId? }." },
      { status: 400 },
    );
  }

  if (parsed.data.checkRunId) {
    const owned = await prisma.checkRun.findFirst({
      where: { id: parsed.data.checkRunId, projectId: authed.project.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json(
        { error: "not_found", message: "checkRunId does not belong to this project." },
        { status: 404 },
      );
    }
  }

  const rehearsal = await prisma.rehearsalRun.create({
    data: {
      projectId: authed.project.id,
      checkRunId: parsed.data.checkRunId ?? null,
      sql: parsed.data.sql,
    },
  });
  await enqueue(QUEUES.rehearsal, { rehearsalId: rehearsal.id });

  return NextResponse.json({ id: rehearsal.id, status: "QUEUED" }, { status: 202 });
}
