import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma, type ApiKey, type Organization, type Project } from "@ballast/db";

export interface AuthedProject {
  project: Project & { org: Organization };
  apiKey: ApiKey;
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Generates a new API key. The plaintext is returned once and never stored. */
export function generateApiKey(): { plaintext: string; hashed: string; prefix: string } {
  const plaintext = `blt_live_${randomBytes(24).toString("hex")}`;
  return {
    plaintext,
    hashed: hashApiKey(plaintext),
    prefix: plaintext.slice(0, 13),
  };
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Resolves the Bearer API key on a request to its project, or null.
 * Lookup is by hash; a constant-time comparison confirms the match.
 */
export async function authenticateApiKey(
  req: Request,
): Promise<AuthedProject | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token.startsWith("blt_")) return null;

  const hashed = hashApiKey(token);
  const apiKey = await prisma.apiKey.findUnique({
    where: { hashedKey: hashed },
    include: { project: { include: { org: true } } },
  });
  if (!apiKey || apiKey.revokedAt) return null;
  if (!constantTimeEqualHex(apiKey.hashedKey, hashed)) return null;

  // Best-effort usage tracking; never let it fail the request.
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  const { project, ...key } = apiKey;
  return { project, apiKey: key as ApiKey };
}

export function unauthorized(): Response {
  return Response.json(
    {
      error: "unauthorized",
      message:
        "Missing or invalid API key. Pass 'Authorization: Bearer blt_live_…' — create keys in project settings.",
    },
    { status: 401 },
  );
}
