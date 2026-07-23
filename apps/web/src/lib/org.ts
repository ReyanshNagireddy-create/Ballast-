import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma, type Organization } from "@ballast/db";

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return base || "org";
}

/**
 * Resolves the signed-in user's Organization row, creating it on first visit.
 * Uses the Clerk organization when one is active, otherwise a personal org
 * keyed by the user id — so solo users never see an org-management wall.
 */
export async function requireOrg(): Promise<Organization> {
  const { userId, orgId, orgSlug } = await auth();
  if (!userId) {
    throw new Error("requireOrg called without an authenticated user");
  }

  const clerkOrgId = orgId ?? `personal_${userId}`;
  const existing = await prisma.organization.findUnique({
    where: { clerkOrgId },
  });
  if (existing) return existing;

  const user = orgId ? null : await currentUser();
  const name = orgId
    ? (orgSlug ?? "Organization")
    : (user?.firstName ? `${user.firstName}'s workspace` : "Personal workspace");

  const baseSlug = slugify(orgSlug ?? name);
  // Suffix on collision — slugs are globally unique.
  let slug = baseSlug;
  for (let i = 0; ; i++) {
    const taken = await prisma.organization.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  const org = await prisma.organization.create({
    data: {
      clerkOrgId,
      name,
      slug,
      members: { create: { clerkUserId: userId, role: "ADMIN" } },
    },
  });
  return org;
}
