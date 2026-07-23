import { NextResponse, type NextRequest } from "next/server";
import { analyzeSql, ConfigError, SEVERITIES } from "@ballast/core";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_SQL_BYTES = 128 * 1024;
const REQUESTS_PER_MINUTE = 30;

const severitySchema = z.enum(SEVERITIES);

const bodySchema = z.object({
  sql: z.string().min(1).max(MAX_SQL_BYTES),
  filename: z.string().max(300).optional(),
  config: z
    .object({
      preset: z
        .enum([
          "raw",
          "prisma",
          "django",
          "rails",
          "drizzle",
          "flyway",
          "goose",
          "golang-migrate",
        ])
        .optional(),
      pgVersion: z.number().int().min(9).max(30).optional(),
      wrapsInTransaction: z.boolean().optional(),
      failOn: severitySchema.optional(),
      rules: z.record(z.union([severitySchema, z.literal("off")])).optional(),
    })
    .optional(),
});

/**
 * POST /api/v1/analyze — stateless analysis. Public (rate-limited); powers the
 * playground and lets integrators try the engine without an account.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = rateLimit(`analyze:${ip}`, REQUESTS_PER_MINUTE);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Try again in a minute." },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      },
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
      {
        error: "invalid_request",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const report = analyzeSql(parsed.data.sql, {
      filename: parsed.data.filename ?? "playground.sql",
      config: parsed.data.config,
    });
    return NextResponse.json(report, {
      headers: { "x-ratelimit-remaining": String(limit.remaining) },
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      return NextResponse.json(
        { error: "invalid_config", message: err.message },
        { status: 400 },
      );
    }
    throw err;
  }
}
