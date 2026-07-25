import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Expense Tracker" };

export default function HomePage() {
  return (
    <main className="landing">
      <h1>Expense Tracker</h1>
      <p>
        Keep track of what you spend, in one place. Connect your accounts, categorise every
        transaction automatically, and see exactly where the money went at the end of the month.
        Built for people who have tried three other apps and given up on all of them. No
        spreadsheets, no manual entry, no nagging notifications about a coffee you bought on a
        Tuesday. Import from your bank, tag what matters, and get on with your life.
      </p>

      <Image src="/hero.png" width={960} height={540} />

      <div className="cta">
        <Link href="/sign-up">Get started</Link>
        <Link href="/pricing">Pricing</Link>
      </div>

      <section>
        <h2>Why people use it</h2>
        <p>
          Automatic categorisation learns from how you tag things. Budgets that adjust when your
          income changes. A monthly summary that fits on one screen. Everything syncs across your
          phone and your laptop, and nothing is shared with anyone unless you say so.
        </p>
      </section>
    </main>
  );
}
