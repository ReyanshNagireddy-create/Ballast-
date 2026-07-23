"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@ballast/db";
import { generateApiKey } from "@/lib/api-auth";
import { requireOrg } from "@/lib/org";

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return base || "project";
}

const PRESETS = new Set([
  "raw",
  "prisma",
  "django",
  "rails",
  "drizzle",
  "flyway",
  "goose",
  "golang-migrate",
]);

export async function createProject(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const org = await requireOrg();

  const name = String(formData.get("name") ?? "").trim();
  const preset = String(formData.get("preset") ?? "raw");
  const repository = String(formData.get("repository") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error("Project name must be 2–80 characters.");
  }
  if (!PRESETS.has(preset)) throw new Error("Unknown preset.");

  if (org.plan === "FREE") {
    const count = await prisma.project.count({ where: { orgId: org.id } });
    if (count >= 1) {
      throw new Error(
        "The free plan includes one project. Upgrade to Team for unlimited projects.",
      );
    }
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let i = 0; ; i++) {
    const exists = await prisma.project.findUnique({
      where: { orgId_slug: { orgId: org.id, slug } },
    });
    if (!exists) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  await prisma.project.create({
    data: {
      orgId: org.id,
      name,
      slug,
      preset,
      repository: repository || null,
    },
  });
  revalidatePath("/dashboard");
}

export interface CreatedKey {
  plaintext: string;
  prefix: string;
}

export async function createProjectApiKey(
  projectSlug: string,
  name: string,
): Promise<CreatedKey> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const org = await requireOrg();

  const project = await prisma.project.findUnique({
    where: { orgId_slug: { orgId: org.id, slug: projectSlug } },
  });
  if (!project) throw new Error("Project not found.");

  const trimmed = name.trim() || "CI key";
  const { plaintext, hashed, prefix } = generateApiKey();
  await prisma.apiKey.create({
    data: { projectId: project.id, name: trimmed.slice(0, 80), hashedKey: hashed, prefix },
  });
  revalidatePath(`/dashboard/${projectSlug}/settings`);
  return { plaintext, prefix };
}

export async function revokeApiKey(
  projectSlug: string,
  keyId: string,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const org = await requireOrg();

  const key = await prisma.apiKey.findFirst({
    where: {
      id: keyId,
      project: { orgId: org.id, slug: projectSlug },
    },
  });
  if (!key) throw new Error("Key not found.");
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/dashboard/${projectSlug}/settings`);
}
