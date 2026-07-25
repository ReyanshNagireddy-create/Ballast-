import Link from "next/link";

export default function PricingPage() {
  return (
    <main>
      <h1>Pricing</h1>
      <div className="plans">
        <div className="plan">
          <h2>Free</h2>
          <p>One account, 100 transactions a month.</p>
          <Link href="/sign-up">Start free</Link>
        </div>
        <div className="plan">
          <h2>Plus — £4/month</h2>
          <p>Unlimited accounts, budgets, and bill splitting.</p>
          <Link href="/sign-up">Upgrade</Link>
        </div>
      </div>
      <Link href="/">Home</Link>
    </main>
  );
}
