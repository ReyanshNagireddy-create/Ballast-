import Link from "next/link";
import { getServerSession } from "../../../lib/auth";

export default async function ExpensesPage() {
  await getServerSession();

  return (
    <main>
      <h1>Transactions</h1>
      <ul>
        <li>
          <Link href="/dashboard/expenses/1">Sainsbury's — £42.10</Link>
        </li>
        <li>
          <Link href="/dashboard/expenses/2">Rent — £950.00</Link>
        </li>
      </ul>
      <Link href="/dashboard">Back</Link>
    </main>
  );
}
