import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Lazily constructed Stripe client so builds and non-billing routes don't
 * require the secret key to be present.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Billing routes are unavailable until it is set — see .env.example.",
    );
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}

export function getTeamPriceId(): string {
  const priceId = process.env.STRIPE_TEAM_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_TEAM_PRICE_ID is not configured — see .env.example.");
  }
  return priceId;
}
