import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@ballast/db";
import { requireOrg } from "@/lib/org";
import { SITE } from "@/lib/seo";
import { getStripe, getTeamPriceId } from "@/lib/stripe";

export const runtime = "nodejs";

/** POST /api/billing/checkout — start a Stripe Checkout session for Team. */
export async function POST(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const org = await requireOrg();
  if (org.plan !== "FREE") {
    return NextResponse.json(
      { error: "already_subscribed", message: "This organization is already on a paid plan." },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const user = await currentUser();
    const customer = await stripe.customers.create({
      name: org.name,
      email: user?.primaryEmailAddress?.emailAddress,
      metadata: { ballastOrgId: org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: getTeamPriceId(), quantity: 1 }],
    success_url: `${SITE.url}/dashboard/billing?upgraded=1`,
    cancel_url: `${SITE.url}/dashboard/billing`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
