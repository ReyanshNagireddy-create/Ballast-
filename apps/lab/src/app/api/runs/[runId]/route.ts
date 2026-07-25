import { NextResponse } from "next/server";
import { getRun } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fetch a finished run, report and all.
 *
 * Also the download endpoint: `?download=1` sets a filename so the browser
 * saves the JSON rather than rendering it, which is the Pro plan's
 * "downloadable reports" with no extra machinery.
 */
export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const url = new URL(request.url);
  if (url.searchParams.get("download") === "1") {
    return new NextResponse(JSON.stringify(run, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="product-lab-${runId}.json"`,
      },
    });
  }

  return NextResponse.json(run);
}
