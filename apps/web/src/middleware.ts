import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/api/billing(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  // Only run Clerk on routes that need it — the marketing site, docs, and
  // public API stay fully functional with no Clerk keys configured.
  matcher: ["/dashboard(.*)", "/api/billing(.*)", "/sign-in(.*)", "/sign-up(.*)"],
};
