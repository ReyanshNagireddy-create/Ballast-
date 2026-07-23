import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireOrg } from "@/lib/org";
import { SITE } from "@/lib/seo";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** POST /api/billing/portal — open the Stripe customer portal. */
export async function POST(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const org = await requireOrg();
  if (!org.stripeCustomerId) {
    return NextResponse.json(
      { error: "no_customer", message: "No billing account yet — upgrade first." },
      { status: 404 },
    );
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${SITE.url}/dashboard/billing`,
  });
  return NextResponse.json({ url: session.url });
}
