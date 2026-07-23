import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@ballast/db";
import { authenticateApiKey, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

/** GET /api/v1/checks/:id — one run with findings, scoped to the key's project. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authed = await authenticateApiKey(req);
  if (!authed) return unauthorized();

  const { id } = await params;
  const run = await prisma.checkRun.findFirst({
    where: { id, projectId: authed.project.id },
    include: { findings: { orderBy: [{ file: "asc" }, { line: "asc" }] } },
  });
  if (!run) {
    return NextResponse.json(
      { error: "not_found", message: "No such check run in this project." },
      { status: 404 },
    );
  }
  return NextResponse.json(run);
}
