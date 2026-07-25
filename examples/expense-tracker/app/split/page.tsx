import Link from "next/link";
import { getServerSession } from "../../lib/auth";

/**
 * Bill splitting. Reachable only from an unlabelled icon in the dashboard
 * sidebar, and never mentioned on the marketing site.
 */
export default async function SplitPage() {
  await getServerSession();

  return (
    <main>
      <h1>Split a bill</h1>
      <form action="/api/split" method="post">
        <label htmlFor="amount">Total</label>
        <input id="amount" name="amount" type="number" required />
        <label htmlFor="people">People</label>
        <input id="people" name="people" type="number" required />
        <button type="submit">Split it</button>
      </form>
      <Link href="/dashboard">Back to dashboard</Link>
    </main>
  );
}
