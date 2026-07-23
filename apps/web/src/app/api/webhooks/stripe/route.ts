import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@ballast/db";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (!org) {
    console.warn(`stripe webhook: no org for customer ${customerId}`);
    return;
  }

  const item = sub.items.data[0];
  const active = sub.status === "active" || sub.status === "trialing";
  const periodEnd = sub.current_period_end;

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: {
        orgId: org.id,
        stripeSubscriptionId: sub.id,
        status: sub.status,
        priceId: item?.price.id ?? "",
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        status: sub.status,
        priceId: item?.price.id ?? "",
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    }),
    prisma.organization.update({
      where: { id: org.id },
      data: { plan: active ? "TEAM" : "FREE" },
    }),
  ]);
}

async function removeSubscription(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!existing) return;
  await prisma.$transaction([
    prisma.subscription.delete({ where: { id: existing.id } }),
    prisma.organization.update({
      where: { id: existing.orgId },
      data: { plan: "FREE" },
    }),
  ]);
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "not_configured", message: "STRIPE_WEBHOOK_SECRET is not set." },
      { status: 503 },
    );
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await req.text(),
      signature,
      secret,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_signature",
        message: err instanceof Error ? err.message : "Verification failed.",
      },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await applySubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await removeSubscription(event.data.object);
      break;
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id,
        );
        await applySubscription(sub);
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      break;
  }

  return NextResponse.json({ received: true });
}
