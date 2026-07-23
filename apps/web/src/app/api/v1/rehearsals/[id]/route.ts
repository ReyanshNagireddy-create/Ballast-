import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@ballast/db";
import { authenticateApiKey, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/v1/rehearsals/:id — status, timings, and error for one rehearsal. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authed = await authenticateApiKey(req);
  if (!authed) return unauthorized();

  const { id } = await params;
  const rehearsal = await prisma.rehearsalRun.findFirst({
    where: { id, projectId: authed.project.id },
  });
  if (!rehearsal) {
    return NextResponse.json(
      { error: "not_found", message: "No such rehearsal in this project." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    id: rehearsal.id,
    status: rehearsal.status,
    timings: rehearsal.timings,
    error: rehearsal.error,
    startedAt: rehearsal.startedAt,
    finishedAt: rehearsal.finishedAt,
  });
}
